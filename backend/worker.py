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
    
    Full execution pipeline:
    1. Fetches data from connectors
    2. Applies cross-reference mappings
    3. Runs pre-validations
    4. Executes user Python code
    5. Stores artifacts
    6. Delivers via SFTP/FTP (if configured)
    7. Updates job status
    """
    from database import SessionLocal
    import models
    from datetime import datetime
    from uuid import UUID
    import json
    
    from services.executor import CodeExecutor
    from services.execution_models import ExecutionContext, ResourceLimits
    from services.auth import decrypt_credentials
    from services.storage import StorageService
    
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
        connector = None
        connector_config = {}
        connector_credentials = {}
        connector_type = "postgresql"  # default
        
        if report_version.connector_id:
            connector = db.query(models.Connector).filter(
                models.Connector.id == report_version.connector_id
            ).first()
            
            if connector:
                connector_config = connector.config
                connector_credentials = decrypt_credentials(connector.encrypted_credentials)
                connector_type = connector.type.value
        
        # Load cross-reference mappings (stub for now)
        # TODO: Implement mapping loading in future iteration
        mappings = {}
        
        # Create execution context
        context = ExecutionContext(
            connector_type=connector_type,
            connector_config=connector_config,
            connector_credentials=connector_credentials,
            mappings=mappings,
            parameters=job_run.parameters or {},
            report_version_id=report_version.id,
            job_run_id=UUID(job_run_id),
            tenant_id=job_run.tenant_id
        )
        
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
        
        # Store artifact in MinIO
        if result.output_data is not None:
            storage = StorageService()
            
            # Determine output format from config
            output_format = report_version.config.get('output_format', 'json')
            
            # Convert output to bytes based on format
            if output_format == 'json':
                import pandas as pd
                if isinstance(result.output_data, pd.DataFrame):
                    artifact_data = result.output_data.to_json(orient='records', date_format='iso').encode('utf-8')
                    filename = f"report_{job_run_id}.json"
                else:
                    artifact_data = json.dumps(result.output_data).encode('utf-8')
                    filename = f"report_{job_run_id}.json"
            
            elif output_format == 'csv':
                import pandas as pd
                if isinstance(result.output_data, pd.DataFrame):
                    artifact_data = result.output_data.to_csv(index=False).encode('utf-8')
                else:
                    # Convert to DataFrame first
                    df = pd.DataFrame(result.output_data)
                    artifact_data = df.to_csv(index=False).encode('utf-8')
                filename = f"report_{job_run_id}.csv"
            
            elif output_format == 'xml':
                import pandas as pd
                if isinstance(result.output_data, pd.DataFrame):
                    artifact_data = result.output_data.to_xml().encode('utf-8')
                else:
                    df = pd.DataFrame(result.output_data)
                    artifact_data = df.to_xml().encode('utf-8')
                filename = f"report_{job_run_id}.xml"
            
            else:
                # Default to JSON
                artifact_data = json.dumps(result.output_data).encode('utf-8')
                filename = f"report_{job_run_id}.json"
            
            # Upload to MinIO
            storage_uri = storage.upload_artifact(
                bucket=settings.ARTIFACT_BUCKET,
                filename=filename,
                data=artifact_data,
                metadata={
                    'job_run_id': str(job_run_id),
                    'report_version_id': str(report_version.id),
                    'output_format': output_format,
                    'execution_time': result.execution_time_seconds
                }
            )
            
            # Create artifact record
            import hashlib
            artifact = models.Artifact(
                job_run_id=UUID(job_run_id),
                filename=filename,
                storage_uri=storage_uri,
                mime_type=f'application/{output_format}',
                size_bytes=len(artifact_data),
                checksum_sha256=hashlib.sha256(artifact_data).hexdigest()
            )
            db.add(artifact)
            
            logger.info(f"Artifact stored: {storage_uri}")
        
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
