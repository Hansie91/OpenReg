"""
Reports API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from database import get_db
from core.problem import NotFoundError, ValidationError, BadRequestError, ConflictError
from services.auth import get_current_user, log_audit
from services.code_generator import CodeGenerator
from services.lineage import LineageService
import models

router = APIRouter()


# === Pydantic Schemas ===

class ReportCreate(BaseModel):
    name: str
    description: Optional[str] = None
    connector_id: Optional[UUID] = None
    config: Optional[dict] = None


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    streaming_config: Optional[dict] = None


class ReportResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    current_version_id: Optional[UUID]
    # Version info from current version
    major_version: Optional[int] = None
    minor_version: Optional[int] = None
    version_string: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportVersionCreate(BaseModel):
    python_code: str
    connector_id: Optional[UUID] = None
    config: Optional[dict] = {}
    bump_major: bool = False  # If True, increment major version (v2.0, v3.0)


class ReportVersionResponse(BaseModel):
    id: UUID
    report_id: UUID
    major_version: int
    minor_version: int
    version_number: int
    version_string: str
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
    
    # Enrich with version info
    result = []
    for report in reports:
        report_dict = {
            'id': report.id,
            'tenant_id': report.tenant_id,
            'name': report.name,
            'description': report.description,
            'current_version_id': report.current_version_id,
            'is_active': report.is_active,
            'created_at': report.created_at,
            'updated_at': report.updated_at,
            'major_version': None,
            'minor_version': None,
            'version_string': None,
        }
        
        # Get current version info if available
        if report.current_version_id:
            try:
                current_version = db.query(models.ReportVersion).filter(
                    models.ReportVersion.id == report.current_version_id
                ).first()
                if current_version:
                    # Handle both old (version_number) and new (major/minor) schema
                    major = getattr(current_version, 'major_version', None)
                    minor = getattr(current_version, 'minor_version', None)
                    if major is not None and minor is not None:
                        report_dict['major_version'] = major
                        report_dict['minor_version'] = minor
                        report_dict['version_string'] = f"v{major}.{minor}"
                    else:
                        # Fallback for old schema
                        vn = getattr(current_version, 'version_number', 1)
                        report_dict['major_version'] = 1
                        report_dict['minor_version'] = vn - 1 if vn > 0 else 0
                        report_dict['version_string'] = f"v1.{vn - 1 if vn > 0 else 0}"
            except Exception:
                # If any error, just use defaults
                pass
        
        result.append(report_dict)
    
    return result


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
    
    # If Simple Mode config provided, generate code and create version
    if report.config and report.config.get('mode') == 'simple':
        source_table = report.config.get('source_table', '')
        field_mappings = report.config.get('field_mappings', [])
        output_format = report.config.get('output_format', 'xml')
        schema_id = report.config.get('schema_id')
        
        # Generate Python code from mappings
        generated_code = CodeGenerator.generate_from_mappings(
            source_table=source_table,
            field_mappings=field_mappings,
            output_format=output_format,
            schema_id=schema_id
        )
        
        # Create initial version with generated code
        db_version = models.ReportVersion(
            report_id=db_report.id,
            major_version=1,
            minor_version=0,
            version_number=1000,  # 1*1000 + 0
            python_code=generated_code,
            connector_id=report.connector_id,
            config=report.config,
            status=models.ReportVersionStatus.DRAFT,
            created_by=current_user.id
        )
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        
        # Set as current version
        db_report.current_version_id = db_version.id
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
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

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
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

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
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

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
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    versions = db.query(models.ReportVersion).filter(
        models.ReportVersion.report_id == report_id
    ).order_by(models.ReportVersion.version_number.desc()).all()
    
    # Add version_string to each version with fallback
    result = []
    for v in versions:
        major = getattr(v, 'major_version', None) or 1
        minor = getattr(v, 'minor_version', None) or 0
        result.append({
            **v.__dict__,
            'major_version': major,
            'minor_version': minor,
            'version_string': f"v{major}.{minor}"
        })
    
    return result


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
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    # Get latest version for semantic versioning
    latest = db.query(models.ReportVersion).filter(
        models.ReportVersion.report_id == report_id
    ).order_by(
        models.ReportVersion.major_version.desc(),
        models.ReportVersion.minor_version.desc()
    ).first()
    
    # Calculate next version
    if version.bump_major:
        new_major = (latest.major_version if latest else 0) + 1
        new_minor = 0
    else:
        new_major = latest.major_version if latest else 1
        new_minor = (latest.minor_version if latest else -1) + 1
    
    version_number = new_major * 1000 + new_minor
    
    # Create version
    db_version = models.ReportVersion(
        report_id=report_id,
        major_version=new_major,
        minor_version=new_minor,
        version_number=version_number,
        python_code=version.python_code,
        connector_id=version.connector_id,
        config=version.config,
        status=models.ReportVersionStatus.ACTIVE,  # Auto-approve
        created_by=current_user.id,
        approved_by=current_user.id,
        approved_at=datetime.utcnow()
    )
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    
    # Set as current version
    report.current_version_id = db_version.id
    db.commit()
    
    # Auto-rebuild lineage for this report
    try:
        LineageService.build_lineage_for_report(db, report_id, current_user.tenant_id)
    except Exception as e:
        # Lineage rebuild failure should not fail version creation
        import logging
        logging.getLogger(__name__).warning(f"Failed to rebuild lineage for report {report_id}: {e}")
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.CREATE, "ReportVersion", str(db_version.id))
    
    # Return with version_string
    return {
        **db_version.__dict__,
        'version_string': f"v{new_major}.{new_minor}"
    }


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
        raise NotFoundError(
            detail=f"Report version with ID '{version_id}' was not found. Verify both report and version IDs are correct."
        )

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
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    if not report.current_version_id:
        raise BadRequestError(
            detail="This report has no active version. Create and approve a version before executing."
        )
    
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
    
    # Enqueue to Celery for async execution using workflow state machine
    from tasks.workflow_tasks import execute_workflow_task
    execute_workflow_task.delay(str(job_run.id))
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.EXECUTE, "Report", str(report.id),
              {"job_run_id": str(job_run.id)})
    
    return {
        "job_run_id": str(job_run.id),
        "status": job_run.status.value,
        "message": "Report execution queued"
    }


# === Execution History & Statistics ===

@router.get("/{report_id}/executions")
async def list_report_executions(
    report_id: UUID,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all job runs for a specific report with filtering"""
    # Verify report exists and belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    # Get all versions of this report
    version_ids = db.query(models.ReportVersion.id).filter(
        models.ReportVersion.report_id == report_id
    ).all()
    version_ids = [v[0] for v in version_ids]

    # Query job runs for these versions
    query = db.query(models.JobRun).filter(
        models.JobRun.report_version_id.in_(version_ids)
    )
    
    # Apply filters
    if status:
        query = query.filter(models.JobRun.status == status)
    
    if from_date:
        query = query.filter(models.JobRun.created_at >= from_date)
    
    if to_date:
        query = query.filter(models.JobRun.created_at <= to_date)
    
    # Get total count
    total_count = query.count()
    
    # Execute with pagination
    runs = query.order_by(
        models.JobRun.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Format response with additional details
    results = []
    for run in runs:
        duration = None
        if run.started_at and run.ended_at:
            duration = (run.ended_at - run.started_at).total_seconds()
        
        artifact_count = db.query(models.Artifact).filter(
            models.Artifact.job_run_id == run.id
        ).count()
        
        results.append({
            "id": run.id,
            "report_version_id": run.report_version_id,
            "status": run.status.value,
            "triggered_by": run.triggered_by.value,
            "created_at": run.created_at,
            "started_at": run.started_at,
            "ended_at": run.ended_at,
            "duration_seconds": duration,
            "artifact_count": artifact_count,
            "error_message": run.error_message
        })
    
    return {
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "data": results
    }


@router.get("/{report_id}/stats")
async def get_report_stats(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution statistics for a report"""
    # Verify report exists and belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    # Get all versions of this report
    version_ids = db.query(models.ReportVersion.id).filter(
        models.ReportVersion.report_id == report_id
    ).all()
    version_ids = [v[0] for v in version_ids]

    # Total executions
    total_executions = db.query(models.JobRun).filter(
        models.JobRun.report_version_id.in_(version_ids)
    ).count()
    
    # Count by status
    status_counts = db.query(
        models.JobRun.status,
        func.count(models.JobRun.id).label('count')
    ).filter(
        models.JobRun.report_version_id.in_(version_ids)
    ).group_by(models.JobRun.status).all()
    
    by_status = {status.value: count for status, count in status_counts}
    
    # Success rate
    success_count = by_status.get('success', 0)
    success_rate = (success_count / total_executions * 100) if total_executions > 0 else 0
    
    # Average execution duration
    completed_runs = db.query(models.JobRun).filter(
        models.JobRun.report_version_id.in_(version_ids),
        models.JobRun.started_at.isnot(None),
        models.JobRun.ended_at.isnot(None)
    ).all()
    
    durations = [(run.ended_at - run.started_at).total_seconds() for run in completed_runs]
    avg_duration = sum(durations) / len(durations) if durations else 0
    
    # Last 30 days trend
    from datetime import timedelta
    thirty_days_ago = datetime.now() - timedelta(days=30)
    
    recent_runs = db.query(
        func.date(models.JobRun.created_at).label('date'),
        models.JobRun.status,
        func.count(models.JobRun.id).label('count')
    ).filter(
        models.JobRun.report_version_id.in_(version_ids),
        models.JobRun.created_at >= thirty_days_ago
    ).group_by(
        func.date(models.JobRun.created_at),
        models.JobRun.status
    ).all()
    
    trend_data = {}
    for date, status, count in recent_runs:
        date_str = date.isoformat()
        if date_str not in trend_data:
            trend_data[date_str] = {}
        trend_data[date_str][status.value] = count
    
    # Last execution
    last_run = db.query(models.JobRun).filter(
        models.JobRun.report_version_id.in_(version_ids)
    ).order_by(models.JobRun.created_at.desc()).first()
    
    last_execution = None
    if last_run:
        last_execution = {
            "status": last_run.status.value,
            "created_at": last_run.created_at,
            "error_message": last_run.error_message
        }
    
    return {
        "total_executions": total_executions,
        "by_status": by_status,
        "success_rate": round(success_rate, 2),
        "avg_duration_seconds": round(avg_duration, 2),
        "last_30_days_trend": trend_data,
        "last_execution": last_execution
    }


# === Report-Destination Linking (Auto-Delivery) ===

class ReportDestinationResponse(BaseModel):
    destination_id: UUID
    destination_name: str
    protocol: str
    host: str
    is_active: bool
    max_retries: int = 3
    retry_backoff: str = "exponential"
    retry_base_delay: int = 60
    retry_max_delay: int = 3600

    class Config:
        from_attributes = True


@router.get("/{report_id}/destinations", response_model=List[ReportDestinationResponse])
async def list_report_destinations(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all destinations linked to this report for auto-delivery."""
    # Verify report belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    # Get linked destinations
    links = db.query(models.ReportDestination).filter(
        models.ReportDestination.report_id == report_id
    ).all()
    
    results = []
    for link in links:
        dest = db.query(models.Destination).filter(
            models.Destination.id == link.destination_id
        ).first()
        if dest:
            config = dest.config or {}
            retry_policy = dest.retry_policy or {}
            results.append(ReportDestinationResponse(
                destination_id=dest.id,
                destination_name=dest.name,
                protocol=dest.protocol.value if dest.protocol else "sftp",
                host=config.get("host", ""),
                is_active=dest.is_active,
                max_retries=retry_policy.get("max_retries", 3),
                retry_backoff=retry_policy.get("retry_backoff", "exponential"),
                retry_base_delay=retry_policy.get("retry_base_delay", 60),
                retry_max_delay=retry_policy.get("retry_max_delay", 3600)
            ))
    
    return results


class LinkDestinationRequest(BaseModel):
    destination_id: UUID


@router.post("/{report_id}/destinations")
async def link_destination(
    report_id: UUID,
    request: LinkDestinationRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Link a destination to this report for auto-delivery on success."""
    # Verify report belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    # Verify destination belongs to tenant
    destination = db.query(models.Destination).filter(
        models.Destination.id == request.destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise NotFoundError(
            detail=f"Destination with ID '{request.destination_id}' was not found. Verify the destination ID is correct."
        )

    # Check if already linked
    existing = db.query(models.ReportDestination).filter(
        models.ReportDestination.report_id == report_id,
        models.ReportDestination.destination_id == request.destination_id
    ).first()
    
    if existing:
        raise ConflictError(
            detail="This destination is already linked to the report. Each destination can only be linked once."
        )
    
    # Create link
    link = models.ReportDestination(
        report_id=report_id,
        destination_id=request.destination_id
    )
    db.add(link)
    db.commit()
    
    return {"message": "Destination linked successfully", "destination_name": destination.name}


@router.delete("/{report_id}/destinations/{destination_id}")
async def unlink_destination(
    report_id: UUID,
    destination_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a destination from auto-delivery for this report."""
    # Verify report belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise NotFoundError(
            detail=f"Report with ID '{report_id}' was not found. Verify the ID is correct."
        )

    # Find and delete link
    link = db.query(models.ReportDestination).filter(
        models.ReportDestination.report_id == report_id,
        models.ReportDestination.destination_id == destination_id
    ).first()
    
    if not link:
        raise NotFoundError(
            detail=f"Destination with ID '{destination_id}' is not linked to this report."
        )
    
    db.delete(link)
    db.commit()
    
    return {"message": "Destination unlinked successfully"}
