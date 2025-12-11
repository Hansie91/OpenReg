"""
Celery worker for asynchronous job execution
"""

from celery import Celery
from celery.schedules import crontab
from config import settings
import logging

logger = logging.getLogger(__name__)

# Create Celery app
app = Celery(
    "openreg_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
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


@app.task(name="execute_report")
def execute_report_task(job_run_id: str):
    """
    Execute a report generation job.
    
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
        connector_type = "postgresql"  # default
        
        if report_version.connector_id:
            connector = db.query(models.Connector).filter(
                models.Connector.id == report_version.connector_id
            ).first()
            
            if connector:
                connector_config = connector.config
                connector_type = connector.type.value
                
                # Create connector instance using factory
                connector_instance = ConnectorFactory.create_connector(
                    db_type=connector_type,
                    config=connector.config,
                    encrypted_credentials=connector.encrypted_credentials
                )
        
        # Load cross-reference mappings (stub for now)
        mappings = {}
        
        # Create execution context
        context = ExecutionContext(
            connector_type=connector_type,
            connector_config=connector_config,
            connector_credentials={},  # Credentials handled by connector_instance
            mappings=mappings,
            parameters=job_run.parameters or {},
            report_version_id=report_version.id,
            job_run_id=UUID(job_run_id),
            tenant_id=job_run.tenant_id,
            query_sql=report_version.query_sql  # If report has a base query
        )
        
        # Get pre-generation validation rules
        pre_gen_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == report_version.id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_GENERATION
        ).all()
        
        pre_gen_rules = [v.validation_rule for v in pre_gen_validations if v.validation_rule.is_active]
        
        # Fetch source data using connector
        source_data = None
        if connector_instance and report_version.query_sql:
            logger.info("Fetching data from database...")
            try:
                results = connector_instance.execute_query(
                    query=report_version.query_sql,
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
            db.commit()
            return
        
        logger.info(f"Code executed successfully in {result.execution_time_seconds:.2f}s")
        
        # Get pre-delivery validation rules
        pre_delivery_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == report_version.id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_DELIVERY
        ).all()
        
        pre_delivery_rules = [v.validation_rule for v in pre_delivery_validations if v.validation_rule.is_active]
        
        # Run pre-delivery validations on output
        final_output = result.output_data
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
        if final_output is not None and isinstance(final_output, pd.DataFrame):
            storage = StorageService()
            
            # Get output formats from config (can be multiple)
            output_formats_config = report_version.config.get('output_formats', ['csv'])
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
                            metadata = ArtifactGenerator.generate_xml(
                                data=final_output,
                                filepath=filepath
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
                        
                        logger.info(f"Artifact generated and stored: {filename} ({metadata['size_bytes']} bytes)")
                        
                    except Exception as e:
                        logger.error(f"Failed to generate {output_format} artifact: {e}")
                        # Continue with other formats
            
            db.commit()
        
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


@app.task(name="deliver_artifact")
def deliver_artifact_task(artifact_id: str, destination_id: str):
    """
    Deliver an artifact to a destination via SFTP/FTP.
    
    TODO: Implement SFTP/FTP delivery with retry logic for v1
    """
    logger.info(f"Delivering artifact {artifact_id} to destination {destination_id}")
    # TODO: Implement paramiko SFTP logic
    pass


# Celery Beat Schedule (for scheduled reports)
app.conf.beat_schedule = {
    # Example: Check for scheduled reports every minute
    'check-scheduled-reports': {
        'task': 'check_schedules',
        'schedule': 60.0,  # Every 60 seconds
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
