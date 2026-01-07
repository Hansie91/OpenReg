"""
Workflow API endpoints.

Provides real-time workflow status, progress tracking,
and workflow management capabilities.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user
from tasks.workflow_tasks import cancel_workflow_task
import models

router = APIRouter()


# === Pydantic Schemas ===

class WorkflowStepResponse(BaseModel):
    """Response for a single workflow step."""
    id: str
    step_name: str
    step_order: int
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    attempt_count: int
    max_attempts: int
    error_message: Optional[str]
    error_code: Optional[str]
    output: Optional[dict]

    class Config:
        from_attributes = True


class WorkflowStatusResponse(BaseModel):
    """Response for workflow execution status."""
    id: str
    job_run_id: str
    workflow_name: str
    workflow_version: str
    current_state: str
    progress_percentage: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    error_message: Optional[str]
    error_code: Optional[str]
    failed_step: Optional[str]
    steps: List[WorkflowStepResponse]
    state_history: Optional[List[dict]]

    class Config:
        from_attributes = True


class WorkflowSummaryResponse(BaseModel):
    """Summary response for listing workflows."""
    id: str
    job_run_id: str
    workflow_name: str
    current_state: str
    progress_percentage: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class CancelWorkflowRequest(BaseModel):
    """Request to cancel a workflow."""
    reason: Optional[str] = "Cancelled by user"


# === Endpoints ===

@router.get("/runs/{job_run_id}/workflow", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    job_run_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed workflow status for a job run.

    Returns current state, progress percentage, step details,
    and state transition history.
    """
    # Verify job run belongs to tenant
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == job_run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()

    if not job_run:
        raise HTTPException(status_code=404, detail="Job run not found")

    # Get workflow execution
    workflow_exec = db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.job_run_id == job_run_id
    ).first()

    if not workflow_exec:
        # No workflow execution yet - return pending status
        return WorkflowStatusResponse(
            id="",
            job_run_id=str(job_run_id),
            workflow_name="report_execution",
            workflow_version="1.0",
            current_state="pending",
            progress_percentage=0,
            started_at=None,
            completed_at=None,
            duration_ms=None,
            error_message=None,
            error_code=None,
            failed_step=None,
            steps=[],
            state_history=[]
        )

    # Get workflow steps
    steps = db.query(models.WorkflowStep).filter(
        models.WorkflowStep.workflow_execution_id == workflow_exec.id
    ).order_by(models.WorkflowStep.step_order).all()

    step_responses = [
        WorkflowStepResponse(
            id=str(step.id),
            step_name=step.step_name,
            step_order=step.step_order,
            status=step.status.value,
            started_at=step.started_at,
            completed_at=step.completed_at,
            duration_ms=step.duration_ms,
            attempt_count=step.attempt_count,
            max_attempts=step.max_attempts,
            error_message=step.error_message,
            error_code=step.error_code,
            output=step.output,
        )
        for step in steps
    ]

    return WorkflowStatusResponse(
        id=str(workflow_exec.id),
        job_run_id=str(workflow_exec.job_run_id),
        workflow_name=workflow_exec.workflow_name,
        workflow_version=workflow_exec.workflow_version,
        current_state=workflow_exec.current_state.value,
        progress_percentage=workflow_exec.progress_percentage,
        started_at=workflow_exec.started_at,
        completed_at=workflow_exec.completed_at,
        duration_ms=workflow_exec.duration_ms,
        error_message=workflow_exec.error_message,
        error_code=workflow_exec.error_code,
        failed_step=workflow_exec.failed_step,
        steps=step_responses,
        state_history=workflow_exec.state_history or []
    )


@router.get("/runs/{job_run_id}/workflow/progress")
async def get_workflow_progress(
    job_run_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get lightweight progress info for a job run.

    Optimized endpoint for polling - returns minimal data.
    """
    # Verify job run belongs to tenant
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == job_run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()

    if not job_run:
        raise HTTPException(status_code=404, detail="Job run not found")

    # Get workflow execution
    workflow_exec = db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.job_run_id == job_run_id
    ).first()

    if not workflow_exec:
        return {
            "state": "pending",
            "progress": 0,
            "current_step": None,
            "is_complete": False,
        }

    # Get current step name
    current_step = None
    steps = db.query(models.WorkflowStep).filter(
        models.WorkflowStep.workflow_execution_id == workflow_exec.id,
        models.WorkflowStep.status == models.StepStatusEnum.RUNNING
    ).first()

    if steps:
        current_step = steps.step_name

    is_complete = workflow_exec.current_state in (
        models.WorkflowStateEnum.COMPLETED,
        models.WorkflowStateEnum.FAILED,
        models.WorkflowStateEnum.CANCELLED
    )

    return {
        "state": workflow_exec.current_state.value,
        "progress": workflow_exec.progress_percentage,
        "current_step": current_step,
        "is_complete": is_complete,
        "error_message": workflow_exec.error_message if is_complete else None,
    }


@router.post("/runs/{job_run_id}/workflow/cancel")
async def cancel_workflow(
    job_run_id: UUID,
    request: CancelWorkflowRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a running workflow.

    Only works for workflows that haven't completed yet.
    """
    # Verify job run belongs to tenant
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == job_run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()

    if not job_run:
        raise HTTPException(status_code=404, detail="Job run not found")

    # Get workflow execution
    workflow_exec = db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.job_run_id == job_run_id
    ).first()

    if not workflow_exec:
        raise HTTPException(status_code=404, detail="Workflow execution not found")

    # Check if already complete
    if workflow_exec.current_state in (
        models.WorkflowStateEnum.COMPLETED,
        models.WorkflowStateEnum.FAILED,
        models.WorkflowStateEnum.CANCELLED
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel workflow in state: {workflow_exec.current_state.value}"
        )

    # Queue cancellation task
    cancel_workflow_task.delay(str(workflow_exec.id), request.reason)

    return {
        "message": "Workflow cancellation requested",
        "workflow_id": str(workflow_exec.id),
        "reason": request.reason
    }


@router.get("/workflows", response_model=List[WorkflowSummaryResponse])
async def list_workflows(
    skip: int = 0,
    limit: int = 50,
    state: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List workflow executions for the tenant.

    Supports filtering by state and pagination.
    """
    query = db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.tenant_id == current_user.tenant_id
    )

    if state:
        try:
            state_enum = models.WorkflowStateEnum(state)
            query = query.filter(models.WorkflowExecution.current_state == state_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid state: {state}")

    workflows = query.order_by(
        models.WorkflowExecution.created_at.desc()
    ).offset(skip).limit(limit).all()

    return [
        WorkflowSummaryResponse(
            id=str(w.id),
            job_run_id=str(w.job_run_id),
            workflow_name=w.workflow_name,
            current_state=w.current_state.value,
            progress_percentage=w.progress_percentage,
            started_at=w.started_at,
            completed_at=w.completed_at,
            error_message=w.error_message,
        )
        for w in workflows
    ]


@router.get("/workflows/stats")
async def get_workflow_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get workflow execution statistics for the tenant.

    Returns counts by state and average durations.
    """
    from sqlalchemy import func

    # Count by state
    state_counts = db.query(
        models.WorkflowExecution.current_state,
        func.count(models.WorkflowExecution.id).label("count")
    ).filter(
        models.WorkflowExecution.tenant_id == current_user.tenant_id
    ).group_by(models.WorkflowExecution.current_state).all()

    by_state = {state.value: count for state, count in state_counts}

    # Average duration for completed workflows
    avg_duration = db.query(
        func.avg(models.WorkflowExecution.duration_ms)
    ).filter(
        models.WorkflowExecution.tenant_id == current_user.tenant_id,
        models.WorkflowExecution.current_state == models.WorkflowStateEnum.COMPLETED,
        models.WorkflowExecution.duration_ms.isnot(None)
    ).scalar()

    # Total count
    total = sum(by_state.values())

    # Success rate
    completed = by_state.get("completed", 0)
    failed = by_state.get("failed", 0)
    success_rate = (completed / (completed + failed) * 100) if (completed + failed) > 0 else 0

    # Currently running
    running_states = ["initializing", "fetching_data", "pre_validation",
                      "transforming", "post_validation", "generating_artifacts", "delivering"]
    running = sum(by_state.get(s, 0) for s in running_states)

    return {
        "total": total,
        "by_state": by_state,
        "running": running,
        "success_rate": round(success_rate, 2),
        "avg_duration_ms": int(avg_duration) if avg_duration else None,
    }
