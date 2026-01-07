"""
Exception Management API

Endpoints for viewing, amending, and resubmitting validation exceptions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from services.auth import get_current_user
import models
from services.validation_engine import ValidationEngine
from services.execution_models import ExecutionContext, ResourceLimits
from services.auth import decrypt_credentials

router = APIRouter(tags=["exceptions"])


# ==================== Request/Response Models ====================

class ExceptionResponse(BaseModel):
    id: UUID
    job_run_id: UUID
    validation_rule_id: UUID
    validation_rule_name: str
    row_number: int
    original_data: dict
    amended_data: Optional[dict]
    error_message: str
    status: str
    amended_by: Optional[UUID]
    amended_at: Optional[datetime]
    created_at: datetime
    # Fields for source tracking
    rejection_source: Optional[str] = "pre_validation"  # pre_validation, regulator_file, regulator_record
    rejection_code: Optional[str] = None
    
    class Config:
        from_attributes = True


class ExceptionListResponse(BaseModel):
    total: int
    exceptions: List[ExceptionResponse]


class AmendExceptionRequest(BaseModel):
    amended_data: dict


class AmendExceptionResponse(BaseModel):
    id: UUID
    status: str
    passes_validation: bool
    message: str


class ResubmitRequest(BaseModel):
    exception_ids: List[UUID]


class ResubmitResponse(BaseModel):
    success: bool
    resubmitted_count: int
    new_job_run_id: Optional[UUID]
    message: str


class ExceptionStatsResponse(BaseModel):
    total_exceptions: int
    pending: int
    amended: int
    resolved: int
    rejected: int
    by_report: dict


# ==================== Endpoints ====================

@router.get("", response_model=ExceptionListResponse)
def list_exceptions(
    status: Optional[str] = Query(None, description="Filter by status"),
    source: Optional[str] = Query(None, description="Filter by source: pre_validation, regulator_file, regulator_record"),
    job_run_id: Optional[UUID] = Query(None, description="Filter by job run"),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List validation exceptions with optional filters"""
    
    query = db.query(models.ValidationException).filter(
        models.ValidationException.job_run_id.in_(
            db.query(models.JobRun.id).filter(
                models.JobRun.tenant_id == current_user.tenant_id
            )
        )
    )
    
    if status:
        try:
            status_enum = models.ExceptionStatus(status.lower())
            query = query.filter(models.ValidationException.status == status_enum)
        except ValueError:
            pass  # Invalid status, skip filter
    
    if job_run_id:
        query = query.filter(models.ValidationException.job_run_id == job_run_id)
    
    total = query.count()
    
    exceptions = query.order_by(
        models.ValidationException.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    # Enrich with validation rule names
    exception_responses = []
    for exc in exceptions:
        rule = db.query(models.ValidationRule).filter(
            models.ValidationRule.id == exc.validation_rule_id
        ).first()
        
        exc_dict = {
            "id": exc.id,
            "job_run_id": exc.job_run_id,
            "validation_rule_id": exc.validation_rule_id,
            "validation_rule_name": rule.name if rule else "Unknown",
            "row_number": exc.row_number,
            "original_data": exc.original_data,
            "amended_data": exc.amended_data,
            "error_message": exc.error_message,
            "status": exc.status.value,
            "amended_by": exc.amended_by,
            "amended_at": exc.amended_at,
            "created_at": exc.created_at,
            "rejection_source": getattr(exc, 'rejection_source', 'pre_validation') or 'pre_validation',
            "rejection_code": getattr(exc, 'rejection_code', None)
        }
        
        # Apply source filter if provided
        if source:
            if exc_dict["rejection_source"] != source:
                continue
        
        exception_responses.append(ExceptionResponse(**exc_dict))
    
    return ExceptionListResponse(
        total=total,
        exceptions=exception_responses
    )


@router.get("/stats", response_model=ExceptionStatsResponse)
def get_exception_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get statistics about validation exceptions"""
    
    # Get all exceptions for tenant
    exceptions = db.query(models.ValidationException).filter(
        models.ValidationException.job_run_id.in_(
            db.query(models.JobRun.id).filter(
                models.JobRun.tenant_id == current_user.tenant_id
            )
        )
    ).all()
    
    total = len(exceptions)
    pending = sum(1 for e in exceptions if e.status == models.ExceptionStatus.PENDING)
    amended = sum(1 for e in exceptions if e.status == models.ExceptionStatus.AMENDED)
    resolved = sum(1 for e in exceptions if e.status == models.ExceptionStatus.RESOLVED)
    rejected = sum(1 for e in exceptions if e.status == models.ExceptionStatus.REJECTED)
    
    # Group by report
    by_report = {}
    for exc in exceptions:
        job_run = db.query(models.JobRun).filter(models.JobRun.id == exc.job_run_id).first()
        if job_run:
            report_version = db.query(models.ReportVersion).filter(
                models.ReportVersion.id == job_run.report_version_id
            ).first()
            if report_version:
                report = db.query(models.Report).filter(
                    models.Report.id == report_version.report_id
                ).first()
                if report:
                    report_name = report.name
                    by_report[report_name] = by_report.get(report_name, 0) + 1
    
    return ExceptionStatsResponse(
        total_exceptions=total,
        pending=pending,
        amended=amended,
        resolved=resolved,
        rejected=rejected,
        by_report=by_report
    )


@router.get("/{exception_id}", response_model=ExceptionResponse)
def get_exception(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get details of a specific exception"""
    
    exception = db.query(models.ValidationException).filter(
        models.ValidationException.id == exception_id
    ).first()
    
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    # Verify tenant access
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == exception.job_run_id
    ).first()
    
    if job_run.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    rule = db.query(models.ValidationRule).filter(
        models.ValidationRule.id == exception.validation_rule_id
    ).first()
    
    return ExceptionResponse(
        id=exception.id,
        job_run_id=exception.job_run_id,
        validation_rule_id=exception.validation_rule_id,
        validation_rule_name=rule.name if rule else "Unknown",
        row_number=exception.row_number,
        original_data=exception.original_data,
        amended_data=exception.amended_data,
        error_message=exception.error_message,
        status=exception.status.value,
        amended_by=exception.amended_by,
        amended_at=exception.amended_at,
        created_at=exception.created_at
    )


@router.put("/{exception_id}/amend", response_model=AmendExceptionResponse)
def amend_exception(
    exception_id: UUID,
    request: AmendExceptionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Amend a failed transaction and re-validate"""
    
    exception = db.query(models.ValidationException).filter(
        models.ValidationException.id == exception_id
    ).first()
    
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    # Verify tenant access
    job_run = db.query(models.JobRun).filter(
        models.JobRun.id == exception.job_run_id
    ).first()
    
    if job_run.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Store amendment
    exception.amended_data = request.amended_data
    exception.status = models.ExceptionStatus.AMENDED
    exception.amended_by = current_user.id
    exception.amended_at = datetime.utcnow()
    
    # Get validation rule
    rule = db.query(models.ValidationRule).filter(
        models.ValidationRule.id == exception.validation_rule_id
    ).first()
    
    # Re-validate the amended data
    import pandas as pd
    amended_df = pd.DataFrame([request.amended_data])
    
    # Get execution context
    report_version = db.query(models.ReportVersion).filter(
        models.ReportVersion.id == job_run.report_version_id
    ).first()
    
    connector = None
    if report_version.connector_id:
        connector = db.query(models.Connector).filter(
            models.Connector.id == report_version.connector_id
        ).first()
    
    context = ExecutionContext(
        connector_type=connector.type.value if connector else "postgresql",
        connector_config=connector.config if connector else {},
        connector_credentials=decrypt_credentials(connector.encrypted_credentials) if connector else {},
        mappings={},
        parameters={},
        report_version_id=report_version.id,
        job_run_id=job_run.id,
        tenant_id=current_user.tenant_id
    )
    
    try:
        validation_result = ValidationEngine.execute_validations(
            data=amended_df,
            rules=[rule],
            phase=models.ExecutionPhase.PRE_GENERATION,
            context=context,
            db=db
        )
        
        passes_validation = validation_result.all_passed
        
        if passes_validation:
            exception.status = models.ExceptionStatus.RESOLVED
            message = "Amendment validated successfully"
        else:
            message = f"Amendment still fails validation: {validation_result.blocking_failures[0].error_messages.get(0, 'Validation failed')}"
        
    except Exception as e:
        passes_validation = False
        message = f"Validation error: {str(e)}"
    
    db.commit()
    
    return AmendExceptionResponse(
        id=exception.id,
        status=exception.status.value,
        passes_validation=passes_validation,
        message=message
    )


@router.post("/resubmit", response_model=ResubmitResponse)
def resubmit_exceptions(
    request: ResubmitRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Resubmit resolved exceptions as a supplemental report"""
    
    # Get all requested exceptions
    exceptions = db.query(models.ValidationException).filter(
        models.ValidationException.id.in_(request.exception_ids),
        models.ValidationException.status == models.ExceptionStatus.RESOLVED
    ).all()
    
    if not exceptions:
        raise HTTPException(
            status_code=400,
            detail="No resolved exceptions found with provided IDs"
        )
    
    # Verify they're all from the same job run
    job_run_ids = set(exc.job_run_id for exc in exceptions)
    if len(job_run_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Exceptions must be from the same job run"
        )
    
    job_run_id = job_run_ids.pop()
    
    # Get original job run
    original_job_run = db.query(models.JobRun).filter(
        models.JobRun.id == job_run_id
    ).first()
    
    if original_job_run.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create supplemental job run
    from tasks.workflow_tasks import execute_workflow_task

    supplemental_job_run = models.JobRun(
        tenant_id=original_job_run.tenant_id,
        report_version_id=original_job_run.report_version_id,
        triggered_by=current_user.id,
        status=models.JobRunStatus.PENDING,
        parameters=original_job_run.parameters or {}
    )
    supplemental_job_run.parameters['supplemental_exceptions'] = [str(exc.id) for exc in exceptions]
    
    db.add(supplemental_job_run)
    db.commit()
    db.refresh(supplemental_job_run)
    
    # Mark exceptions as resubmitted
    for exception in exceptions:
        exception.status = models.ExceptionStatus.RESUBMITTED
        exception.resubmitted_at = datetime.utcnow()
        exception.resubmitted_job_run_id = supplemental_job_run.id
    
    db.commit()

    # Trigger execution using workflow state machine
    execute_workflow_task.delay(str(supplemental_job_run.id))

    return ResubmitResponse(
        success=True,
        resubmitted_count=len(exceptions),
        new_job_run_id=supplemental_job_run.id,
        message=f"Successfully resubmitted {len(exceptions)} exceptions"
    )
