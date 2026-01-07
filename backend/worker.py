"""
Celery worker for asynchronous job execution

This module defines the Celery application and registers tasks.
Report execution uses a workflow state machine for tracking progress.
"""

from celery import Celery
from celery.schedules import crontab
from config import settings
import logging

logger = logging.getLogger(__name__)

# Create Celery app
app = Celery(
    "openreg_worker",
    broker=settings.celery_broker,
    backend=settings.celery_backend
)

# Celery configuration
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.WORKER_MAX_EXECUTION_TIME,
    worker_max_memory_per_child=settings.WORKER_MAX_MEMORY_MB * 1024  # Convert to KB
)

# Autodiscover tasks from the tasks package
# This registers workflow_tasks and step_tasks with Celery
app.autodiscover_tasks(['tasks'])


@app.task(name="execute_report")
def execute_report_task(job_run_id: str):
    """
    Execute a report generation job (legacy implementation).

    NOTE: This is the legacy monolithic implementation. For new executions,
    use execute_workflow_task from tasks.workflow_tasks which provides:
    - State machine with explicit workflow states
    - Real-time progress tracking
    - Per-step retry with configurable backoff
    - Workflow cancellation support
    - Detailed step-by-step execution history

    Full execution pipeline with validation:
    1. Fetch data from connectors
    2. Run pre-generation validations
    3. Segregate passing/failing records
    4. Execute Python code on passed records
    5. Run pre-delivery validations
    6. Store artifacts for passed records
    7. Store exceptions for failed records
    8. Update job status
    """
    from database import SessionLocal
    import models
    from datetime import datetime
    from uuid import UUID
    import json
    
    from services.executor import CodeExecutor
    from services.execution_models import ExecutionContext, ResourceLimits
    from services.storage import StorageService
    from services.validation_engine import ValidationEngine
    from services.connectors.factory import ConnectorFactory
    from services.artifacts.generator import ArtifactGenerator
    import pandas as pd
    import tempfile
    import os
    
    logger.info(f"Executing report for job_run_id: {job_run_id}")
    
    db = SessionLocal()
    try:
        # Fetch job run
        job_run = db.query(models.JobRun).filter(
            models.JobRun.id == UUID(job_run_id)
        ).first()
        
        if not job_run:
            logger.error(f"Job run {job_run_id} not found")
            return
        
        # Update status to running
        job_run.status = models.JobRunStatus.RUNNING
        job_run.started_at = datetime.utcnow()
        db.commit()
        
        # Get report version
        report_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == job_run.report_version_id
        ).first()
        
        if not report_version:
            raise Exception(f"Report version not found")
        
        logger.info(f"Executing report version {report_version.version_number}")
        
        # Get connector if specified
        connector_instance = None
        connector_config = {}
        connector_credentials = {}
        connector_type = "postgresql"  # default
        
        if report_version.connector_id:
            connector = db.query(models.Connector).filter(
                models.Connector.id == report_version.connector_id
            ).first()
            
            if connector:
                connector_config = connector.config
                connector_type = connector.type.value
                
                # Decrypt credentials for use in query_db
                from services.auth import decrypt_credentials
                try:
                    connector_credentials = decrypt_credentials(connector.encrypted_credentials)
                except Exception as e:
                    logger.error(f"Failed to decrypt credentials: {e}")
                    connector_credentials = {}
                
                # Create connector instance using factory
                connector_instance = ConnectorFactory.create_connector(
                    db_type=connector_type,
                    config=connector.config,
                    encrypted_credentials=connector.encrypted_credentials
                )
        
        # Load cross-reference mappings (stub for now)
        mappings = {}
        
        # Create execution context
        # Note: query_sql may not exist on ReportVersion - use getattr with None default
        query_sql = getattr(report_version, 'query_sql', None) or report_version.config.get('query_sql')
        
        context = ExecutionContext(
            connector_type=connector_type,
            connector_config=connector_config,
            connector_credentials=connector_credentials,  # Pass decrypted credentials for query_db
            mappings=mappings,
            parameters=job_run.parameters or {},
            report_version_id=report_version.id,
            job_run_id=UUID(job_run_id),
            tenant_id=job_run.tenant_id,
            query_sql=query_sql
        )
        
        # Get pre-generation validation rules
        pre_gen_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == report_version.id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_GENERATION
        ).all()
        
        pre_gen_rules = [v.validation_rule for v in pre_gen_validations if v.validation_rule.is_active]
        
        # Fetch source data using connector (only if query_sql is provided)
        source_data = None
        if connector_instance and query_sql:
            logger.info("Fetching data from database...")
            try:
                results = connector_instance.execute_query(
                    query=query_sql,
                    timeout=300  # 5 minute timeout
                )
                source_data = pd.DataFrame(results)
                logger.info(f"Fetched {len(source_data)} rows from source")
            finally:
                connector_instance.disconnect()
        
        # Run pre-generation validations
        if pre_gen_rules and source_data is not None and not source_data.empty:
            logger.info(f"Running {len(pre_gen_rules)} pre-generation validations...")
            pre_val_result = ValidationEngine.execute_validations(
                data=source_data,
                rules=pre_gen_rules,
                phase=models.ExecutionPhase.PRE_GENERATION,
                context=context,
                db=db
            )
            
            # Store validation results
            ValidationEngine.store_validation_results(
                job_run_id=UUID(job_run_id),
                phase=models.ExecutionPhase.PRE_GENERATION,
                validation_result=pre_val_result,
                db=db
            )
            
            # Check for blocking failures
            if pre_val_result.blocking_failures:
                logger.error(f"Blocking validation failures: {len(pre_val_result.blocking_failures)}")
                job_run.status = models.JobRunStatus.FAILED
                job_run.error_message = f"Blocking validation failed: {pre_val_result.blocking_failures[0].rule_name}"
                job_run.ended_at = datetime.utcnow()
                db.commit()
                return
            
            # Store exceptions for correctable failures
            if pre_val_result.correctable_failures:
                logger.info(f"Storing {pre_val_result.failed_rows} exceptions for manual review")
                ValidationEngine.store_validation_exceptions(
                    job_run_id=UUID(job_run_id),
                    data=source_data,
                    validation_result=pre_val_result,
                    db=db
                )
                db.commit()
            
            # Use only passed data for execution
            execution_data = pre_val_result.passed_data
            logger.info(f"Processing {len(execution_data)} passed records ({pre_val_result.failed_rows} failed)")
        else:
            execution_data = source_data
        
        # Create resource limits from config
        limits = ResourceLimits(
            max_memory_mb=settings.CODE_MAX_MEMORY_MB,
            max_execution_seconds=settings.CODE_MAX_EXECUTION_SECONDS,
            max_output_size_mb=settings.CODE_MAX_OUTPUT_SIZE_MB,
            max_code_lines=settings.CODE_MAX_LINES
        )
        
        # Execute Python code
        logger.info("Executing user Python code...")
        result = CodeExecutor.execute(
            code=report_version.python_code,
            context=context,
            limits=limits
        )
        
        if not result.success:
            # Execution failed
            logger.error(f"Code execution failed: {result.error}")
            job_run.status = models.JobRunStatus.FAILED
            job_run.error_message = f"{result.error_type}: {result.error}"
            job_run.ended_at = datetime.utcnow()
            
            # Persist execution logs even on failure
            if result.logs:
                for i, log_msg in enumerate(result.logs):
                    log_entry = models.JobRunLog(
                        job_run_id=job_run.id,
                        line_number=i + 1,
                        level=models.LogLevel.INFO,
                        message=log_msg
                    )
                    db.add(log_entry)
            
            db.commit()
            return
        
        logger.info(f"Code executed successfully in {result.execution_time_seconds:.2f}s")
        
        # Persist execution logs to database for UI display
        if result.logs:
            logger.info(f"Persisting {len(result.logs)} execution log entries")
            for i, log_msg in enumerate(result.logs):
                log_entry = models.JobRunLog(
                    job_run_id=job_run.id,
                    line_number=i + 1,
                    level=models.LogLevel.INFO,
                    message=log_msg
                )
                db.add(log_entry)
            db.commit()
        
        # Get pre-delivery validation rules
        pre_delivery_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == report_version.id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_DELIVERY
        ).all()
        
        pre_delivery_rules = [v.validation_rule for v in pre_delivery_validations if v.validation_rule.is_active]
        
        # Run pre-delivery validations on output
        final_output = result.output_data
        
        # Preserve raw list of dicts for hierarchical XML generation
        raw_output_data = None
        if isinstance(final_output, list) and len(final_output) > 0:
            # Check if first element is a dict with nested structure (for hierarchical XML)
            first_elem = final_output[0]
            if isinstance(first_elem, dict):
                # Check for nested dicts (indicates hierarchical structure)
                has_nested = any(isinstance(v, dict) for v in first_elem.values())
                if has_nested:
                    raw_output_data = final_output  # Preserve for hierarchical XML
                    logger.info(f"Preserved {len(final_output)} records with nested structure for hierarchical XML")
        
        # Convert list/dict to DataFrame if needed (for validations and non-XML formats)
        if final_output is not None:
            if isinstance(final_output, list) and len(final_output) > 0:
                logger.info(f"Converting list of {len(final_output)} records to DataFrame")
                final_output = pd.DataFrame(final_output)
            elif isinstance(final_output, dict):
                logger.info("Converting dict to DataFrame")
                final_output = pd.DataFrame([final_output])
        
        if pre_delivery_rules and final_output is not None:
            import pandas as pd
            if isinstance(final_output, pd.DataFrame):
                logger.info(f"Running {len(pre_delivery_rules)} pre-delivery validations...")
                post_val_result = ValidationEngine.execute_validations(
                    data=final_output,
                    rules=pre_delivery_rules,
                    phase=models.ExecutionPhase.PRE_DELIVERY,
                    context=context,
                    db=db
                )
                
                # Store validation results
                ValidationEngine.store_validation_results(
                    job_run_id=UUID(job_run_id),
                    phase=models.ExecutionPhase.PRE_DELIVERY,
                    validation_result=post_val_result,
                    db=db
                )
                
                # Check for blocking failures
                if post_val_result.blocking_failures:
                    logger.error(f"Pre-delivery blocking validation failures")
                    job_run.status = models.JobRunStatus.FAILED
                    job_run.error_message = f"Output validation failed: {post_val_result.blocking_failures[0].rule_name}"
                    job_run.ended_at = datetime.utcnow()
                    db.commit()
                    return
                
                # Store exceptions
                if post_val_result.correctable_failures:
                    ValidationEngine.store_validation_exceptions(
                        job_run_id=UUID(job_run_id),
                        data=final_output,
                        validation_result=post_val_result,
                        db=db
                    )
                    db.commit()
                
                # Use only passed data for artifact
                final_output = post_val_result.passed_data
        
        # Store artifacts in MinIO (support multiple formats)
        # Check if output is raw XML content (from Advanced Mode Python code)
        raw_xml_content = None
        if isinstance(final_output, dict) and '__xml_content__' in final_output:
            raw_xml_content = final_output['__xml_content__']
            logger.info("Detected raw XML content from Python code")
        
        if raw_xml_content is not None:
            # Handle raw XML content generated by Python code
            storage = StorageService()
            
            with tempfile.TemporaryDirectory() as temp_dir:
                filename = f"report_{job_run_id}.xml"
                filepath = os.path.join(temp_dir, filename)
                
                # Write XML with declaration
                xml_with_declaration = f'<?xml version="1.0" encoding="UTF-8"?>\n{raw_xml_content}'
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(xml_with_declaration)
                
                # Calculate checksums
                import hashlib
                with open(filepath, 'rb') as f:
                    content = f.read()
                    md5_checksum = hashlib.md5(content).hexdigest()
                    sha256_checksum = hashlib.sha256(content).hexdigest()
                
                # Upload to MinIO
                storage_uri = storage.upload_artifact(
                    bucket=settings.ARTIFACT_BUCKET,
                    filename=filename,
                    data=content,
                    metadata={
                        'job_run_id': str(job_run_id),
                        'report_version_id': str(report_version.id),
                        'output_format': 'xml',
                        'execution_time': result.execution_time_seconds,
                        'md5_checksum': md5_checksum
                    }
                )
                
                # Create artifact record
                artifact = models.Artifact(
                    job_run_id=UUID(job_run_id),
                    filename=filename,
                    storage_uri=storage_uri,
                    mime_type='application/xml',
                    size_bytes=len(content),
                    checksum_sha256=sha256_checksum
                )
                db.add(artifact)
                db.commit()
                
                logger.info(f"Raw XML artifact stored: {filename} ({len(content)} bytes)")
        
        elif final_output is not None and isinstance(final_output, pd.DataFrame):
            storage = StorageService()
            
            # Get output formats from config (support both singular and plural keys)
            output_formats_config = report_version.config.get('output_format') or report_version.config.get('output_formats', 'csv')
            if isinstance(output_formats_config, str):
                output_formats = [output_formats_config]
            else:
                output_formats = output_formats_config
            
            # Create temp directory for artifacts
            with tempfile.TemporaryDirectory() as temp_dir:
                
                for output_format in output_formats:
                    try:
                        # Generate artifact file
                        filename = f"report_{job_run_id}.{output_format}"
                        filepath = os.path.join(temp_dir, filename)
                        
                        # Generate artifact using ArtifactGenerator
                        if output_format == 'csv':
                            metadata = ArtifactGenerator.generate_csv(
                                data=final_output,
                                filepath=filepath
                            )
                        elif output_format == 'json':
                            metadata = ArtifactGenerator.generate_json(
                                data=final_output,
                                filepath=filepath
                            )
                        elif output_format == 'xml':
                            # Get field mappings for hierarchical XML generation
                            field_mappings = report_version.config.get('field_mappings', [])
                            namespace = report_version.config.get('namespace')
                            namespace_prefix = report_version.config.get('namespace_prefix')
                            
                            # Get XML formatting options from output_config
                            output_config = report_version.config.get('output_config', {})
                            xml_options = output_config.get('xml', {})
                            pretty_print = xml_options.get('pretty_print', True)
                            include_declaration = xml_options.get('include_declaration', True)
                            root_name = xml_options.get('root_element', 'Document')
                            row_name = xml_options.get('row_element', 'Tx')
                            
                            # Use hierarchical generator if we have nested dict data
                            if raw_output_data is not None:
                                logger.info(f"Using hierarchical XML generator for {len(raw_output_data)} nested records")
                                metadata = ArtifactGenerator.generate_xml_from_dicts(
                                    data=raw_output_data,
                                    filepath=filepath,
                                    root_name=root_name,
                                    row_name=row_name,
                                    pretty_print=pretty_print,
                                    include_declaration=include_declaration,
                                    namespace=namespace,
                                    namespace_prefix=namespace_prefix
                                )
                            else:
                                metadata = ArtifactGenerator.generate_xml(
                                    data=final_output,
                                    filepath=filepath,
                                    root_name=root_name,
                                    field_mappings=field_mappings,
                                    namespace=namespace,
                                    namespace_prefix=namespace_prefix,
                                    pretty_print=pretty_print,
                                    include_declaration=include_declaration
                                )
                        elif output_format == 'txt':
                            # Tab-delimited text file
                            metadata = ArtifactGenerator.generate_txt(
                                data=final_output,
                                filepath=filepath,
                                delimiter='\t'
                            )
                        else:
                            logger.warning(f"Unknown output format: {output_format}, skipping")
                            continue
                        
                        # Read artifact file
                        with open(filepath, 'rb') as f:
                            artifact_data = f.read()
                        
                        # Upload to MinIO
                        storage_uri = storage.upload_artifact(
                            bucket=settings.ARTIFACT_BUCKET,
                            filename=filename,
                            data=artifact_data,
                            metadata={
                                'job_run_id': str(job_run_id),
                                'report_version_id': str(report_version.id),
                                'output_format': output_format,
                                'execution_time': result.execution_time_seconds,
                                'row_count': metadata['row_count'],
                                'md5_checksum': metadata['md5_checksum']
                            }
                        )
                        
                        # Create artifact record in database
                        artifact = models.Artifact(
                            job_run_id=UUID(job_run_id),
                            filename=filename,
                            storage_uri=storage_uri,
                            mime_type=metadata['mime_type'],
                            size_bytes=metadata['size_bytes'],
                            checksum_sha256=metadata['sha256_checksum']
                        )
                        db.add(artifact)
                        db.flush()  # Ensure artifact is written immediately
                        
                        logger.info(f"Artifact generated and stored: {filename} ({metadata['size_bytes']} bytes)")
                        
                    except Exception as e:
                        logger.error(f"Failed to generate {output_format} artifact: {e}")
                        # Continue with other formats
            
            # Commit all artifacts
            db.commit()
            logger.info(f"Committed {len(output_formats)} artifact(s) to database")
            
            # === Auto-Delivery: Trigger delivery to linked destinations ===
            try:
                # Get report from report version
                report = db.query(models.Report).filter(
                    models.Report.id == report_version.report_id
                ).first()
                
                if report:
                    # Get linked destinations for this report
                    report_destinations = db.query(models.ReportDestination).filter(
                        models.ReportDestination.report_id == report.id
                    ).all()
                    
                    if report_destinations:
                        # Get all artifacts created for this job run
                        artifacts = db.query(models.Artifact).filter(
                            models.Artifact.job_run_id == UUID(job_run_id)
                        ).all()
                        
                        logger.info(f"Auto-delivery: Found {len(report_destinations)} destination(s) for {len(artifacts)} artifact(s)")
                        
                        for artifact in artifacts:
                            for rd in report_destinations:
                                # Check if destination is active
                                dest = db.query(models.Destination).filter(
                                    models.Destination.id == rd.destination_id,
                                    models.Destination.is_active == True
                                ).first()
                                
                                if dest:
                                    logger.info(f"Queueing auto-delivery: {artifact.filename} -> {dest.name}")
                                    deliver_artifact_task.delay(str(artifact.id), str(dest.id))
            except Exception as e:
                logger.error(f"Auto-delivery error (non-fatal): {e}")
                # Don't fail the job if auto-delivery queueing fails
        
        # Mark job as successful
        job_run.status = models.JobRunStatus.SUCCESS
        job_run.ended_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Report execution completed successfully for {job_run_id}")
        
    except Exception as e:
        logger.error(f"Error executing report {job_run_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        if 'job_run' in locals() and job_run:
            job_run.status = models.JobRunStatus.FAILED
            job_run.error_message = str(e)
            job_run.ended_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@app.task(name="deliver_artifact", bind=True, max_retries=10)
def deliver_artifact_task(self, artifact_id: str, destination_id: str, attempt_number: int = 1):
    """
    Deliver an artifact to a destination via SFTP/FTP.
    
    Implements configurable retry with exponential/linear/fixed backoff.
    Retry policy is read from the destination's retry_policy field:
    - max_attempts: Maximum number of delivery attempts (default: 3)
    - backoff: Retry strategy - 'exponential', 'linear', or 'fixed' (default: exponential)
    - base_delay: Base delay in seconds for backoff calculation (default: 5)
    - max_delay: Maximum delay between retries in seconds (default: 300)
    """
    from services.delivery import DeliveryService
    from services.auth import decrypt_credentials
    
    db = SessionLocal()
    delivery_attempt = None
    
    try:
        logger.info(f"Delivering artifact {artifact_id} to destination {destination_id} (attempt {attempt_number})")
        
        # Get artifact
        artifact = db.query(models.Artifact).filter(
            models.Artifact.id == UUID(artifact_id)
        ).first()
        
        if not artifact:
            logger.error(f"Artifact {artifact_id} not found")
            return {"success": False, "error": "Artifact not found"}
        
        # Get destination
        destination = db.query(models.Destination).filter(
            models.Destination.id == UUID(destination_id)
        ).first()
        
        if not destination:
            logger.error(f"Destination {destination_id} not found")
            return {"success": False, "error": "Destination not found"}
        
        if not destination.is_active:
            logger.warning(f"Destination {destination_id} is inactive, skipping delivery")
            return {"success": False, "error": "Destination is inactive"}
        
        # Get retry policy from destination
        retry_policy = destination.retry_policy or {}
        max_attempts = retry_policy.get("max_attempts", 3)
        backoff_type = retry_policy.get("backoff", "exponential")
        base_delay = retry_policy.get("base_delay", 5)
        max_delay = retry_policy.get("max_delay", 300)
        
        # Create delivery attempt record
        delivery_attempt = models.DeliveryAttempt(
            artifact_id=UUID(artifact_id),
            destination_id=UUID(destination_id),
            attempt_number=attempt_number,
            status=models.DeliveryStatus.PENDING
        )
        db.add(delivery_attempt)
        db.commit()
        db.refresh(delivery_attempt)
        
        # Get config and credentials
        config = destination.config or {}
        host = config.get("host", "")
        port = config.get("port", 22 if destination.protocol == models.DeliveryProtocol.SFTP else 21)
        directory = config.get("directory", "/")
        use_tls = config.get("use_tls", False)
        
        # Decrypt credentials
        if not destination.encrypted_credentials:
            raise ValueError("No credentials stored for destination")
        
        creds = decrypt_credentials(destination.encrypted_credentials)
        username = creds.get("username", "")
        password = creds.get("password", "")
        
        # Download artifact from MinIO
        storage = StorageService()
        artifact_data = storage.download_artifact(artifact.storage_uri)
        
        if not artifact_data:
            raise ValueError("Failed to download artifact from storage")
        
        # Save to temp file for upload
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{artifact.filename}") as tmp:
            tmp.write(artifact_data)
            local_path = tmp.name
        
        try:
            # Build remote path
            remote_filename = artifact.filename
            if directory.endswith("/"):
                remote_path = f"{directory}{remote_filename}"
            else:
                remote_path = f"{directory}/{remote_filename}"
            
            # Upload via appropriate protocol
            if destination.protocol == models.DeliveryProtocol.SFTP:
                result = DeliveryService.upload_file_sftp(
                    host=host,
                    port=port,
                    username=username,
                    password=password,
                    local_path=local_path,
                    remote_path=remote_path
                )
            else:  # FTP
                result = DeliveryService.upload_file_ftp(
                    host=host,
                    port=port,
                    username=username,
                    password=password,
                    local_path=local_path,
                    remote_path=remote_path,
                    use_tls=use_tls
                )
            
            if result["success"]:
                # Mark delivery as successful
                delivery_attempt.status = models.DeliveryStatus.DELIVERED
                delivery_attempt.completed_at = datetime.utcnow()
                
                # Update destination's last delivery info
                config["last_delivery_at"] = datetime.utcnow().isoformat()
                config["last_status"] = "success"
                destination.config = config
                
                db.commit()
                logger.info(f"Delivery successful: {artifact.filename} -> {host}:{remote_path}")
                
                return {"success": True, "message": result["message"]}
            else:
                raise Exception(result["message"])
                
        finally:
            # Clean up temp file
            if os.path.exists(local_path):
                os.remove(local_path)
                
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Delivery attempt {attempt_number} failed: {error_msg}")
        
        # Update delivery attempt with error
        if delivery_attempt:
            delivery_attempt.status = models.DeliveryStatus.FAILED
            delivery_attempt.error_message = error_msg
            delivery_attempt.completed_at = datetime.utcnow()
            db.commit()
        
        # Check if we should retry
        retry_policy = {}
        try:
            destination = db.query(models.Destination).filter(
                models.Destination.id == UUID(destination_id)
            ).first()
            if destination:
                retry_policy = destination.retry_policy or {}
        except:
            pass
        
        max_attempts = retry_policy.get("max_attempts", 3)
        
        if attempt_number < max_attempts:
            # Calculate backoff delay
            backoff_type = retry_policy.get("backoff", "exponential")
            base_delay = retry_policy.get("base_delay", 5)
            max_delay = retry_policy.get("max_delay", 300)
            
            if backoff_type == "exponential":
                delay = min(base_delay * (2 ** (attempt_number - 1)), max_delay)
            elif backoff_type == "linear":
                delay = min(base_delay * attempt_number, max_delay)
            else:  # fixed
                delay = base_delay
            
            logger.info(f"Retrying delivery in {delay} seconds (attempt {attempt_number + 1}/{max_attempts})")
            
            # Schedule retry
            raise self.retry(
                exc=e,
                countdown=delay,
                kwargs={
                    "artifact_id": artifact_id,
                    "destination_id": destination_id,
                    "attempt_number": attempt_number + 1
                }
            )
        else:
            logger.error(f"Delivery failed after {max_attempts} attempts")
            
            # Update destination's last delivery info
            try:
                if destination:
                    config = destination.config or {}
                    config["last_delivery_at"] = datetime.utcnow().isoformat()
                    config["last_status"] = "failed"
                    destination.config = config
                    db.commit()
            except:
                pass
            
            return {"success": False, "error": error_msg, "attempts": attempt_number}
    
    finally:
        db.close()


# Celery Beat Schedule (for scheduled reports and external API sync)
app.conf.beat_schedule = {
    # Check for scheduled reports every minute
    'check-scheduled-reports': {
        'task': 'check_schedules',
        'schedule': 60.0,  # Every 60 seconds
    },
    # Check for external API syncs that need to run
    'check-external-api-syncs': {
        'task': 'tasks.external_sync_tasks.check_scheduled_syncs_task',
        'schedule': 60.0,  # Every 60 seconds
    },
    # Clean up old sync logs daily at 3 AM
    'cleanup-external-sync-logs': {
        'task': 'tasks.external_sync_tasks.cleanup_old_sync_logs_task',
        'schedule': crontab(hour=3, minute=0),
    },
}


@app.task(name="check_schedules")
def check_schedules_task():
    """
    Check for scheduled reports that need to be executed.
    
    TODO: Implement schedule checking logic for v1
    """
    logger.info("Checking for scheduled reports...")
    # TODO: Query schedules where next_run_at <= now
    # - Create job runs
    # - Enqueue execute_report_task
    # - Update next_run_at based on cron expression
    pass
