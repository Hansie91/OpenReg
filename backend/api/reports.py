"""
Reports API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user, log_audit
import models

router = APIRouter()


# === Pydantic Schemas ===

class ReportCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ReportResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    current_version_id: Optional[UUID]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportVersionCreate(BaseModel):
    python_code: str
    connector_id: Optional[UUID] = None
    config: Optional[dict] = {}


class ReportVersionResponse(BaseModel):
    id: UUID
    report_id: UUID
    version_number: int
    python_code: str
    connector_id: Optional[UUID]
    config: dict
    status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ExecuteReportRequest(BaseModel):
    parameters: Optional[dict] = {}


# === Endpoints ===

@router.get("", response_model=List[ReportResponse])
async def list_reports(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all reports for the current tenant"""
    query = db.query(models.Report).filter(models.Report.tenant_id == current_user.tenant_id)
    
    if is_active is not None:
        query = query.filter(models.Report.is_active == is_active)
    
    reports = query.offset(skip).limit(limit).all()
    return reports


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report: ReportCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new report"""
    db_report = models.Report(
        tenant_id=current_user.tenant_id,
        name=report.name,
        description=report.description,
        created_by=current_user.id
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.CREATE, "Report", str(db_report.id))
    
    return db_report


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific report"""
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: UUID,
    report_update: ReportUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a report"""
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Track changes for audit
    changes = {}
    for field, value in report_update.dict(exclude_unset=True).items():
        if getattr(report, field) != value:
            changes[field] = {"old": getattr(report, field), "new": value}
            setattr(report, field, value)
    
    db.commit()
    db.refresh(report)
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.UPDATE, "Report", str(report.id), changes)
    
    return report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a report"""
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Audit log before deletion
    log_audit(db, current_user, models.AuditAction.DELETE, "Report", str(report.id))
    
    db.delete(report)
    db.commit()


# === Version Management ===

@router.get("/{report_id}/versions", response_model=List[ReportVersionResponse])
async def list_report_versions(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all versions of a report"""
    # Verify report exists and belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    versions = db.query(models.ReportVersion).filter(
        models.ReportVersion.report_id == report_id
    ).order_by(models.ReportVersion.version_number.desc()).all()
    
    return versions


@router.post("/{report_id}/versions", response_model=ReportVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_report_version(
    report_id: UUID,
    version: ReportVersionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new version of a report"""
    # Verify report exists and belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get next version number
    max_version = db.query(models.ReportVersion).filter(
        models.ReportVersion.report_id == report_id
    ).count()
    next_version = max_version + 1
    
    # Create version
    db_version = models.ReportVersion(
        report_id=report_id,
        version_number=next_version,
        python_code=version.python_code,
        connector_id=version.connector_id,
        config=version.config,
        status=models.ReportVersionStatus.DRAFT,
        created_by=current_user.id
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.CREATE, "ReportVersion", str(db_version.id))
    
    return db_version


@router.put("/{report_id}/versions/{version_id}/approve", response_model=ReportVersionResponse)
async def approve_report_version(
    report_id: UUID,
    version_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a report version and set it as active"""
    version = db.query(models.ReportVersion).filter(
        models.ReportVersion.id == version_id,
        models.ReportVersion.report_id == report_id
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Report version not found")
    
    # Archive current active version
    if version.report.current_version_id:
        current_version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == version.report.current_version_id
        ).first()
        if current_version:
            current_version.status = models.ReportVersionStatus.ARCHIVED
    
    # Activate new version
    version.status = models.ReportVersionStatus.ACTIVE
    version.approved_by = current_user.id
    version.approved_at = datetime.utcnow()
    
    # Update report's current version
    version.report.current_version_id = version.id
    
    db.commit()
    db.refresh(version)
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.UPDATE, "ReportVersion", str(version.id), 
              {"action": "approved"})
    
    return version


# === Execution ===

@router.post("/{report_id}/execute")
async def execute_report(
    report_id: UUID,
    execute_request: ExecuteReportRequest,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger manual execution of a report"""
    # Verify report exists and has an active version
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not report.current_version_id:
        raise HTTPException(status_code=400, detail="Report has no active version")
    
    # Create job run
    job_run = models.JobRun(
        tenant_id=current_user.tenant_id,
        report_version_id=report.current_version_id,
        triggered_by=models.TriggeredBy.MANUAL,
        trigger_user_id=current_user.id,
        status=models.JobRunStatus.PENDING,
        parameters=execute_request.parameters
    )
    db.add(job_run)
    db.commit()
    db.refresh(job_run)
    
    # Enqueue to Celery (will be implemented in worker.py)
    # For MVP, we'll return the job_run and implement async execution later
    # background_tasks.add_task(execute_report_task, str(job_run.id))
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.EXECUTE, "Report", str(report.id),
              {"job_run_id": str(job_run.id)})
    
    return {
        "job_run_id": str(job_run.id),
        "status": job_run.status.value,
        "message": "Report execution queued"
    }


# TODO: Additional endpoints for v1
# - GET /{report_id}/versions/{version_id} - Get specific version details
# - POST /{report_id}/clone - Clone a report
# - GET /{report_id}/schedule - Get report schedule
# - GET /{report_id}/runs - Get execution history for report
