"""
Workflow orchestration tasks.

Main entry point for executing report workflows via Celery.
Handles workflow lifecycle, state persistence, and callbacks.
"""

import logging
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from celery import shared_task
from sqlalchemy.orm import Session

from database import SessionLocal
from services.workflow import (
    WorkflowExecutor,
    WorkflowState,
    StepResult,
    WorkflowExecutionContext,
    REPORT_WORKFLOW,
)
from services.workflow.executor import StepExecutor
from .step_tasks import register_step_handlers
import models

logger = logging.getLogger(__name__)


def get_db() -> Session:
    """Get database session."""
    return SessionLocal()


async def _persist_workflow_state(
    db: Session,
    workflow_execution_id: str,
    state: WorkflowState,
    progress: int,
    error_message: Optional[str] = None,
    error_code: Optional[str] = None,
    failed_step: Optional[str] = None,
    state_history: Optional[list] = None
):
    """Persist workflow state to database."""
    execution = db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.id == workflow_execution_id
    ).first()

    if execution:
        execution.current_state = models.WorkflowStateEnum(state.value)
        execution.progress_percentage = progress
        execution.error_message = error_message
        execution.error_code = error_code
        execution.failed_step = failed_step
        execution.updated_at = datetime.utcnow()

        if state_history:
            execution.state_history = state_history

        if state in (WorkflowState.COMPLETED, WorkflowState.FAILED, WorkflowState.CANCELLED):
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                execution.duration_ms = int(
                    (execution.completed_at - execution.started_at).total_seconds() * 1000
                )

        db.commit()


async def _persist_step_state(
    db: Session,
    workflow_execution_id: str,
    step_name: str,
    status: str,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    error_code: Optional[str] = None,
    attempt_count: int = 0,
    output: Optional[Dict] = None
):
    """Persist step state to database."""
    step = db.query(models.WorkflowStep).filter(
        models.WorkflowStep.workflow_execution_id == workflow_execution_id,
        models.WorkflowStep.step_name == step_name
    ).first()

    if step:
        step.status = models.StepStatusEnum(status)
        if started_at:
            step.started_at = started_at
        if completed_at:
            step.completed_at = completed_at
        if duration_ms is not None:
            step.duration_ms = duration_ms
        step.error_message = error_message
        step.error_code = error_code
        step.attempt_count = attempt_count
        if output:
            step.output = output
        step.updated_at = datetime.utcnow()
        db.commit()


async def _execute_workflow_async(
    job_run_id: str,
    workflow_execution_id: str
) -> StepResult:
    """
    Async implementation of workflow execution.
    """
    db = get_db()

    try:
        # Load job run and report version
        job_run = db.query(models.JobRun).filter(
            models.JobRun.id == job_run_id
        ).first()

        if not job_run:
            raise ValueError(f"Job run not found: {job_run_id}")

        report_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == job_run.report_version_id
        ).first()

        if not report_version:
            raise ValueError(f"Report version not found: {job_run.report_version_id}")

        # Get report for destinations check
        report = db.query(models.Report).filter(
            models.Report.id == report_version.report_id
        ).first()

        # Check for validations
        pre_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == report_version.id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_GENERATION
        ).count()

        post_validations = db.query(models.ReportValidation).filter(
            models.ReportValidation.report_version_id == report_version.id,
            models.ReportValidation.execution_phase == models.ExecutionPhase.PRE_DELIVERY
        ).count()

        # Check for destinations
        destinations = db.query(models.ReportDestination).filter(
            models.ReportDestination.report_id == report.id
        ).count() if report else 0

        # Create execution context
        context = WorkflowExecutionContext(
            workflow_execution_id=workflow_execution_id,
            job_run_id=job_run_id,
            tenant_id=str(job_run.tenant_id),
            report_version_id=str(job_run.report_version_id),
            parameters=job_run.parameters or {},
            has_pre_validations=pre_validations > 0,
            has_post_validations=post_validations > 0,
            has_destinations=destinations > 0,
            python_code=report_version.python_code,
            report_config=report_version.config or {},
        )

        # Load connector config if available
        if report_version.connector_id:
            connector = db.query(models.Connector).filter(
                models.Connector.id == report_version.connector_id
            ).first()
            if connector:
                context.connector_config = connector.config

        # Create step executor with registered handlers
        step_executor = StepExecutor()
        register_step_handlers(step_executor)

        # Create workflow executor with callbacks
        async def on_state_change(from_state, to_state, metadata):
            progress = REPORT_WORKFLOW.get_progress_percentage(to_state)
            await _persist_workflow_state(
                db,
                workflow_execution_id,
                to_state,
                progress,
                error_message=metadata.get("error_message"),
                error_code=metadata.get("error_code"),
                failed_step=metadata.get("failed_step")
            )
            # Update job run status
            job_run.status = _map_workflow_to_job_status(to_state)
            if to_state == WorkflowState.COMPLETED:
                job_run.ended_at = datetime.utcnow()
            elif to_state == WorkflowState.FAILED:
                job_run.ended_at = datetime.utcnow()
                job_run.error_message = metadata.get("error_message")
            db.commit()

            # Emit webhook events for key state transitions
            try:
                from services.webhooks import WebhookEventEmitter

                if to_state == WorkflowState.INITIALIZING and from_state == WorkflowState.PENDING:
                    # Job started
                    WebhookEventEmitter.emit_job_started(db, job_run, report)

                elif to_state == WorkflowState.COMPLETED:
                    # Job completed successfully - calculate duration
                    duration_ms = None
                    if job_run.started_at and job_run.ended_at:
                        duration_ms = int((job_run.ended_at - job_run.started_at).total_seconds() * 1000)
                    WebhookEventEmitter.emit_job_completed(db, job_run, report, duration_ms)

                elif to_state == WorkflowState.FAILED:
                    # Job failed
                    WebhookEventEmitter.emit_job_failed(
                        db, job_run, report,
                        metadata.get("error_message")
                    )
            except Exception as webhook_err:
                logger.warning(f"Failed to emit webhook event: {webhook_err}")

        async def on_step_complete(step_name, result):
            await _persist_step_state(
                db,
                workflow_execution_id,
                step_name,
                result.status.value,
                completed_at=datetime.utcnow(),
                duration_ms=result.duration_ms,
                error_message=result.error_message,
                error_code=result.error_code,
                attempt_count=result.retry_count,
                output=result.output
            )

        executor = WorkflowExecutor(
            workflow=REPORT_WORKFLOW,
            step_executor=step_executor,
            on_state_change=on_state_change,
            on_step_complete=on_step_complete
        )

        # Update workflow execution start time
        workflow_exec = db.query(models.WorkflowExecution).filter(
            models.WorkflowExecution.id == workflow_execution_id
        ).first()
        if workflow_exec:
            workflow_exec.started_at = datetime.utcnow()
            db.commit()

        # Update job run start time
        job_run.started_at = datetime.utcnow()
        job_run.status = models.JobRunStatus.RUNNING
        db.commit()

        # Execute workflow
        result = await executor.execute(context, db)

        # Save final context snapshot
        if workflow_exec:
            workflow_exec.context_snapshot = context.to_dict()
            workflow_exec.state_history = [
                {
                    "from_state": t.from_state.value if t.from_state else None,
                    "to_state": t.to_state.value,
                    "timestamp": t.timestamp.isoformat(),
                    "reason": t.reason,
                }
                for t in executor._state_machine.history
            ]
            db.commit()

        return result

    except Exception as e:
        logger.error(f"Workflow execution failed: {e}", exc_info=True)
        # Update job run status
        try:
            job_run = db.query(models.JobRun).filter(
                models.JobRun.id == job_run_id
            ).first()
            if job_run:
                job_run.status = models.JobRunStatus.FAILED
                job_run.error_message = str(e)
                job_run.ended_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()


def _map_workflow_to_job_status(workflow_state: WorkflowState) -> models.JobRunStatus:
    """Map workflow state to job run status."""
    mapping = {
        WorkflowState.PENDING: models.JobRunStatus.PENDING,
        WorkflowState.INITIALIZING: models.JobRunStatus.RUNNING,
        WorkflowState.FETCHING_DATA: models.JobRunStatus.RUNNING,
        WorkflowState.PRE_VALIDATION: models.JobRunStatus.RUNNING,
        WorkflowState.TRANSFORMING: models.JobRunStatus.RUNNING,
        WorkflowState.POST_VALIDATION: models.JobRunStatus.RUNNING,
        WorkflowState.GENERATING_ARTIFACTS: models.JobRunStatus.RUNNING,
        WorkflowState.DELIVERING: models.JobRunStatus.RUNNING,
        WorkflowState.COMPLETED: models.JobRunStatus.SUCCESS,
        WorkflowState.FAILED: models.JobRunStatus.FAILED,
        WorkflowState.CANCELLED: models.JobRunStatus.FAILED,
        WorkflowState.WAITING_RETRY: models.JobRunStatus.RUNNING,
        WorkflowState.PAUSED: models.JobRunStatus.PENDING,
    }
    return mapping.get(workflow_state, models.JobRunStatus.RUNNING)


@shared_task(bind=True, max_retries=0)
def execute_workflow_task(self, job_run_id: str):
    """
    Celery task to execute a report workflow.

    This is the main entry point for report execution.
    Creates a workflow execution record and runs the workflow.

    Args:
        job_run_id: ID of the job run to execute
    """
    logger.info(f"Starting workflow execution for job run: {job_run_id}")

    db = get_db()
    try:
        # Get job run
        job_run = db.query(models.JobRun).filter(
            models.JobRun.id == job_run_id
        ).first()

        if not job_run:
            logger.error(f"Job run not found: {job_run_id}")
            return {"error": "Job run not found"}

        # Check if workflow execution already exists
        existing = db.query(models.WorkflowExecution).filter(
            models.WorkflowExecution.job_run_id == job_run_id
        ).first()

        if existing:
            workflow_execution_id = str(existing.id)
            logger.info(f"Resuming existing workflow execution: {workflow_execution_id}")
        else:
            # Create workflow execution record
            workflow_exec = models.WorkflowExecution(
                tenant_id=job_run.tenant_id,
                job_run_id=job_run.id,
                workflow_name=REPORT_WORKFLOW.name,
                workflow_version=REPORT_WORKFLOW.version,
                current_state=models.WorkflowStateEnum.PENDING,
                progress_percentage=0,
            )
            db.add(workflow_exec)
            db.commit()
            db.refresh(workflow_exec)
            workflow_execution_id = str(workflow_exec.id)

            # Create step records
            for i, step in enumerate(REPORT_WORKFLOW.steps):
                step_record = models.WorkflowStep(
                    workflow_execution_id=workflow_exec.id,
                    step_name=step.name,
                    step_order=i,
                    status=models.StepStatusEnum.PENDING,
                    max_attempts=step.max_retries + 1,
                )
                db.add(step_record)
            db.commit()

            logger.info(f"Created workflow execution: {workflow_execution_id}")

        db.close()

        # Run async workflow
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                _execute_workflow_async(job_run_id, workflow_execution_id)
            )
            return {
                "status": result.status.value,
                "workflow_execution_id": workflow_execution_id,
                "duration_ms": result.duration_ms,
                "error": result.error_message if result.is_failure else None,
            }
        finally:
            loop.close()

    except Exception as e:
        logger.error(f"Workflow task failed: {e}", exc_info=True)
        return {"error": str(e)}
    finally:
        if db:
            db.close()


@shared_task(bind=True)
def cancel_workflow_task(self, workflow_execution_id: str, reason: str = "Cancelled by user"):
    """
    Celery task to cancel a running workflow.

    Args:
        workflow_execution_id: ID of the workflow execution to cancel
        reason: Cancellation reason
    """
    logger.info(f"Cancelling workflow execution: {workflow_execution_id}")

    db = get_db()
    try:
        workflow_exec = db.query(models.WorkflowExecution).filter(
            models.WorkflowExecution.id == workflow_execution_id
        ).first()

        if not workflow_exec:
            return {"error": "Workflow execution not found"}

        if workflow_exec.current_state in (
            models.WorkflowStateEnum.COMPLETED,
            models.WorkflowStateEnum.FAILED,
            models.WorkflowStateEnum.CANCELLED
        ):
            return {"error": "Workflow already in terminal state"}

        # Update workflow state
        workflow_exec.current_state = models.WorkflowStateEnum.CANCELLED
        workflow_exec.completed_at = datetime.utcnow()
        if workflow_exec.started_at:
            workflow_exec.duration_ms = int(
                (workflow_exec.completed_at - workflow_exec.started_at).total_seconds() * 1000
            )

        # Update job run
        job_run = db.query(models.JobRun).filter(
            models.JobRun.id == workflow_exec.job_run_id
        ).first()
        if job_run:
            job_run.status = models.JobRunStatus.FAILED
            job_run.error_message = reason
            job_run.ended_at = datetime.utcnow()

        db.commit()

        return {"status": "cancelled", "reason": reason}

    finally:
        db.close()
