"""
Delivery API - Endpoints for artifact delivery management

Provides manual delivery triggers, delivery history, and delivery attempt tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from database import get_db
from services.auth import get_current_user
import models
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

router = APIRouter()


# === Pydantic Models ===

class DeliveryTriggerRequest(BaseModel):
    destination_id: UUID


class DeliveryAttemptResponse(BaseModel):
    id: UUID
    artifact_id: UUID
    destination_id: UUID
    destination_name: Optional[str] = None
    attempt_number: int
    status: str
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DeliveryHistoryResponse(BaseModel):
    total: int
    attempts: List[DeliveryAttemptResponse]


# === API Endpoints ===

@router.post("/artifacts/{artifact_id}/deliver")
async def trigger_delivery(
    artifact_id: UUID,
    request: DeliveryTriggerRequest,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger delivery of an artifact to a destination.
    
    This will enqueue a Celery task to upload the artifact to the specified
    SFTP/FTP destination. The delivery will use the destination's configured
    retry policy if the first attempt fails.
    """
    # Verify artifact exists
    artifact = db.query(models.Artifact).filter(
        models.Artifact.id == artifact_id
    ).first()
    
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    
    # Verify job run belongs to user's tenant
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == artifact.job_run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()
    
    if not job_run:
        raise HTTPException(status_code=404, detail="Artifact not found")
    
    # Verify destination exists and belongs to tenant
    destination = db.query(models.Destination).filter(
        models.Destination.id == request.destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    if not destination.is_active:
        raise HTTPException(status_code=400, detail="Destination is inactive")
    
    # Enqueue delivery task
    from worker import deliver_artifact_task
    deliver_artifact_task.delay(str(artifact_id), str(request.destination_id))
    
    return {
        "message": "Delivery queued",
        "artifact_id": str(artifact_id),
        "destination_id": str(request.destination_id),
        "destination_name": destination.name
    }


@router.get("/artifacts/{artifact_id}/deliveries", response_model=DeliveryHistoryResponse)
async def get_artifact_deliveries(
    artifact_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get delivery history for a specific artifact.
    
    Returns all delivery attempts for this artifact, sorted by most recent first.
    """
    # Verify artifact exists and belongs to user's tenant
    artifact = db.query(models.Artifact).filter(
        models.Artifact.id == artifact_id
    ).first()
    
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == artifact.job_run_id,
        models.JobRun.tenant_id == current_user.tenant_id
    ).first()
    
    if not job_run:
        raise HTTPException(status_code=404, detail="Artifact not found")
    
    # Get delivery attempts
    attempts = db.query(models.DeliveryAttempt).filter(
        models.DeliveryAttempt.artifact_id == artifact_id
    ).order_by(desc(models.DeliveryAttempt.created_at)).all()
    
    # Enrich with destination names
    results = []
    for attempt in attempts:
        dest = db.query(models.Destination).filter(
            models.Destination.id == attempt.destination_id
        ).first()
        
        results.append(DeliveryAttemptResponse(
            id=attempt.id,
            artifact_id=attempt.artifact_id,
            destination_id=attempt.destination_id,
            destination_name=dest.name if dest else None,
            attempt_number=attempt.attempt_number,
            status=attempt.status.value,
            error_message=attempt.error_message,
            created_at=attempt.created_at,
            completed_at=attempt.completed_at
        ))
    
    return DeliveryHistoryResponse(total=len(results), attempts=results)


@router.get("/destinations/{destination_id}/deliveries", response_model=DeliveryHistoryResponse)
async def get_destination_deliveries(
    destination_id: UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get delivery history for a specific destination.
    
    Returns recent delivery attempts to this destination, sorted by most recent first.
    """
    # Verify destination exists and belongs to tenant
    destination = db.query(models.Destination).filter(
        models.Destination.id == destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    # Get total count
    total = db.query(models.DeliveryAttempt).filter(
        models.DeliveryAttempt.destination_id == destination_id
    ).count()
    
    # Get delivery attempts with pagination
    attempts = db.query(models.DeliveryAttempt).filter(
        models.DeliveryAttempt.destination_id == destination_id
    ).order_by(desc(models.DeliveryAttempt.created_at)).offset(skip).limit(limit).all()
    
    results = []
    for attempt in attempts:
        results.append(DeliveryAttemptResponse(
            id=attempt.id,
            artifact_id=attempt.artifact_id,
            destination_id=attempt.destination_id,
            destination_name=destination.name,
            attempt_number=attempt.attempt_number,
            status=attempt.status.value,
            error_message=attempt.error_message,
            created_at=attempt.created_at,
            completed_at=attempt.completed_at
        ))
    
    return DeliveryHistoryResponse(total=total, attempts=results)
