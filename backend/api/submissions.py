"""
Submissions API

Endpoints for managing file submissions, record tracking, and regulator responses.
Enables the full regulatory reporting lifecycle:
- Track files sent to regulators
- Track individual record status
- Upload and process regulator responses
- Handle amendments and resubmissions
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID
import json

from database import get_db
from services.auth import get_current_user
import models

router = APIRouter()


# ==================== Pydantic Models ====================

class FileSubmissionResponse(BaseModel):
    id: UUID
    job_run_id: UUID
    business_date: date
    submission_sequence: int
    file_name: str
    status: str
    record_count: int
    error_count: int
    submitted_at: Optional[datetime]
    response_received_at: Optional[datetime]
    response_code: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RecordSubmissionResponse(BaseModel):
    id: UUID
    file_submission_id: Optional[UUID]
    business_date: date
    record_ref: str
    row_number: Optional[int]
    status: str
    rejection_source: Optional[str]
    rejection_code: Optional[str]
    rejection_message: Optional[str]
    original_data: dict
    amended_data: Optional[dict]
    amended_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class RecordAmendRequest(BaseModel):
    amended_data: dict
    reason: Optional[str] = None


class RecordAmendResponse(BaseModel):
    id: UUID
    status: str
    message: str


class RegulatorResponseUpload(BaseModel):
    """Manual entry of regulator response"""
    overall_status: str = Field(..., description="accepted, rejected, or partial")
    response_code: Optional[str] = None
    response_message: Optional[str] = None
    rejections: Optional[List[dict]] = None  # [{record_ref, code, message}]


class SubmissionStatsResponse(BaseModel):
    total_files: int
    pending_files: int
    accepted_files: int
    rejected_files: int
    total_records: int
    pre_validation_failed: int
    record_rejected: int
    pending_amendment: int


class BusinessDateSummary(BaseModel):
    business_date: date
    total_records: int
    submitted: int
    accepted: int
    rejected: int
    pending: int
    is_complete: bool


# ==================== File Submission Endpoints ====================

@router.get("/files", response_model=List[FileSubmissionResponse])
async def list_file_submissions(
    business_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List file submissions with optional filters."""
    query = db.query(models.FileSubmission).filter(
        models.FileSubmission.tenant_id == current_user.tenant_id
    )
    
    if business_date:
        query = query.filter(models.FileSubmission.business_date == business_date)
    
    if status:
        try:
            status_enum = models.FileSubmissionStatus(status.lower())
            query = query.filter(models.FileSubmission.status == status_enum)
        except ValueError:
            pass
    
    files = query.order_by(
        models.FileSubmission.business_date.desc(),
        models.FileSubmission.submission_sequence.desc()
    ).offset(offset).limit(limit).all()
    
    return [
        FileSubmissionResponse(
            id=f.id,
            job_run_id=f.job_run_id,
            business_date=f.business_date,
            submission_sequence=f.submission_sequence,
            file_name=f.file_name,
            status=f.status.value,
            record_count=f.record_count,
            error_count=f.error_count,
            submitted_at=f.submitted_at,
            response_received_at=f.response_received_at,
            response_code=f.response_code,
            created_at=f.created_at
        )
        for f in files
    ]


@router.get("/files/{file_id}", response_model=FileSubmissionResponse)
async def get_file_submission(
    file_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific file submission."""
    file_sub = db.query(models.FileSubmission).filter(
        models.FileSubmission.id == file_id,
        models.FileSubmission.tenant_id == current_user.tenant_id
    ).first()
    
    if not file_sub:
        raise HTTPException(status_code=404, detail="File submission not found")
    
    return FileSubmissionResponse(
        id=file_sub.id,
        job_run_id=file_sub.job_run_id,
        business_date=file_sub.business_date,
        submission_sequence=file_sub.submission_sequence,
        file_name=file_sub.file_name,
        status=file_sub.status.value,
        record_count=file_sub.record_count,
        error_count=file_sub.error_count,
        submitted_at=file_sub.submitted_at,
        response_received_at=file_sub.response_received_at,
        response_code=file_sub.response_code,
        created_at=file_sub.created_at
    )


@router.post("/files/{file_id}/response")
async def register_regulator_response(
    file_id: UUID,
    response: RegulatorResponseUpload,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register regulator response for a file submission.
    
    This is how regulator responses are ingested:
    1. User uploads/enters the response manually
    2. System updates file status
    3. Individual records are marked as accepted/rejected
    4. Rejected records appear in the amendment queue
    """
    file_sub = db.query(models.FileSubmission).filter(
        models.FileSubmission.id == file_id,
        models.FileSubmission.tenant_id == current_user.tenant_id
    ).first()
    
    if not file_sub:
        raise HTTPException(status_code=404, detail="File submission not found")
    
    # Update file status
    try:
        file_sub.status = models.FileSubmissionStatus(response.overall_status.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    file_sub.response_received_at = datetime.utcnow()
    file_sub.response_code = response.response_code
    file_sub.response_message = response.response_message
    
    # Create RegulatorResponse record
    reg_response = models.RegulatorResponse(
        tenant_id=current_user.tenant_id,
        file_submission_id=file_id,
        overall_status=file_sub.status,
        total_records=file_sub.record_count,
        ingestion_method='manual_entry',
        ingested_by=current_user.id,
        parsed_rejections=response.rejections
    )
    
    rejected_count = 0
    accepted_count = 0
    
    # Process rejections if any
    if response.rejections:
        for rejection in response.rejections:
            record_ref = rejection.get('record_ref')
            if record_ref:
                record = db.query(models.RecordSubmission).filter(
                    models.RecordSubmission.file_submission_id == file_id,
                    models.RecordSubmission.record_ref == record_ref
                ).first()
                
                if record:
                    old_status = record.status
                    record.status = models.RecordStatus.RECORD_REJECTED
                    record.rejection_source = models.ExceptionSource.REGULATOR_RECORD
                    record.rejection_code = rejection.get('code')
                    record.rejection_message = rejection.get('message')
                    
                    # Add status history
                    history = models.RecordStatusHistory(
                        record_id=record.id,
                        from_status=old_status,
                        to_status=record.status,
                        changed_by=current_user.id,
                        change_reason=f"Regulator rejection: {rejection.get('code')}"
                    )
                    db.add(history)
                    rejected_count += 1
    
    # Mark remaining as accepted (if file accepted or partial)
    if file_sub.status in [models.FileSubmissionStatus.ACCEPTED, models.FileSubmissionStatus.PARTIAL]:
        records_to_accept = db.query(models.RecordSubmission).filter(
            models.RecordSubmission.file_submission_id == file_id,
            models.RecordSubmission.status == models.RecordStatus.SUBMITTED
        ).all()
        
        for record in records_to_accept:
            old_status = record.status
            record.status = models.RecordStatus.ACCEPTED
            
            history = models.RecordStatusHistory(
                record_id=record.id,
                from_status=old_status,
                to_status=record.status,
                changed_by=current_user.id,
                change_reason="Regulator accepted"
            )
            db.add(history)
            accepted_count += 1
    
    # If file rejected, mark all records as file_rejected
    if file_sub.status == models.FileSubmissionStatus.REJECTED:
        records_to_reject = db.query(models.RecordSubmission).filter(
            models.RecordSubmission.file_submission_id == file_id,
            models.RecordSubmission.status == models.RecordStatus.SUBMITTED
        ).all()
        
        for record in records_to_reject:
            old_status = record.status
            record.status = models.RecordStatus.FILE_REJECTED
            record.rejection_source = models.ExceptionSource.REGULATOR_FILE
            record.rejection_code = response.response_code
            record.rejection_message = response.response_message
            
            history = models.RecordStatusHistory(
                record_id=record.id,
                from_status=old_status,
                to_status=record.status,
                changed_by=current_user.id,
                change_reason=f"File rejected: {response.response_code}"
            )
            db.add(history)
            rejected_count += 1
    
    reg_response.accepted_records = accepted_count
    reg_response.rejected_records = rejected_count
    file_sub.error_count = rejected_count
    
    db.add(reg_response)
    db.commit()
    
    return {
        "success": True,
        "message": f"Response registered. {accepted_count} accepted, {rejected_count} rejected.",
        "accepted_count": accepted_count,
        "rejected_count": rejected_count
    }


# ==================== Record Submission Endpoints ====================

@router.get("/records", response_model=List[RecordSubmissionResponse])
async def list_record_submissions(
    business_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="Filter by rejection source: pre_validation, regulator_file, regulator_record"),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List record submissions with filters.
    
    Use this to see pre-validation failures, regulator rejections, etc.
    """
    query = db.query(models.RecordSubmission).filter(
        models.RecordSubmission.tenant_id == current_user.tenant_id
    )
    
    if business_date:
        query = query.filter(models.RecordSubmission.business_date == business_date)
    
    if status:
        try:
            status_enum = models.RecordStatus(status.lower())
            query = query.filter(models.RecordSubmission.status == status_enum)
        except ValueError:
            pass
    
    if source:
        try:
            source_enum = models.ExceptionSource(source.lower())
            query = query.filter(models.RecordSubmission.rejection_source == source_enum)
        except ValueError:
            pass
    
    records = query.order_by(
        models.RecordSubmission.business_date.desc(),
        models.RecordSubmission.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [
        RecordSubmissionResponse(
            id=r.id,
            file_submission_id=r.file_submission_id,
            business_date=r.business_date,
            record_ref=r.record_ref,
            row_number=r.row_number,
            status=r.status.value,
            rejection_source=r.rejection_source.value if r.rejection_source else None,
            rejection_code=r.rejection_code,
            rejection_message=r.rejection_message,
            original_data=r.original_data,
            amended_data=r.amended_data,
            amended_at=r.amended_at,
            created_at=r.created_at
        )
        for r in records
    ]


@router.put("/records/{record_id}/amend", response_model=RecordAmendResponse)
async def amend_record(
    record_id: UUID,
    request: RecordAmendRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Amend a rejected or failed record.
    
    The record is marked as 'amended' and ready for resubmission.
    """
    record = db.query(models.RecordSubmission).filter(
        models.RecordSubmission.id == record_id,
        models.RecordSubmission.tenant_id == current_user.tenant_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Only allow amending failed/rejected records
    amendable_statuses = [
        models.RecordStatus.PRE_VALIDATION_FAILED,
        models.RecordStatus.FILE_REJECTED,
        models.RecordStatus.RECORD_REJECTED
    ]
    
    if record.status not in amendable_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot amend record with status '{record.status.value}'"
        )
    
    old_status = record.status
    record.amended_data = request.amended_data
    record.amended_by = current_user.id
    record.amended_at = datetime.utcnow()
    record.status = models.RecordStatus.AMENDED
    
    # Add status history
    history = models.RecordStatusHistory(
        record_id=record.id,
        from_status=old_status,
        to_status=record.status,
        changed_by=current_user.id,
        change_reason=request.reason or "User amendment",
        data_snapshot=request.amended_data
    )
    db.add(history)
    db.commit()
    
    return RecordAmendResponse(
        id=record.id,
        status=record.status.value,
        message="Record amended successfully. Ready for resubmission."
    )


@router.get("/records/{record_id}/history")
async def get_record_history(
    record_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the full status history of a record (audit trail)."""
    record = db.query(models.RecordSubmission).filter(
        models.RecordSubmission.id == record_id,
        models.RecordSubmission.tenant_id == current_user.tenant_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    history = db.query(models.RecordStatusHistory).filter(
        models.RecordStatusHistory.record_id == record_id
    ).order_by(models.RecordStatusHistory.changed_at).all()
    
    return {
        "record_id": record_id,
        "current_status": record.status.value,
        "history": [
            {
                "from_status": h.from_status.value if h.from_status else None,
                "to_status": h.to_status.value,
                "changed_at": h.changed_at.isoformat(),
                "change_reason": h.change_reason
            }
            for h in history
        ]
    }


# ==================== Statistics & Summary ====================

@router.get("/stats", response_model=SubmissionStatsResponse)
async def get_submission_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall submission statistics."""
    tenant_id = current_user.tenant_id
    
    # File stats
    file_stats = db.query(
        models.FileSubmission.status,
        func.count(models.FileSubmission.id)
    ).filter(
        models.FileSubmission.tenant_id == tenant_id
    ).group_by(models.FileSubmission.status).all()
    
    file_counts = {s.value: c for s, c in file_stats}
    
    # Record stats
    record_stats = db.query(
        models.RecordSubmission.status,
        func.count(models.RecordSubmission.id)
    ).filter(
        models.RecordSubmission.tenant_id == tenant_id
    ).group_by(models.RecordSubmission.status).all()
    
    record_counts = {s.value: c for s, c in record_stats}
    
    return SubmissionStatsResponse(
        total_files=sum(file_counts.values()),
        pending_files=file_counts.get('pending', 0) + file_counts.get('submitted', 0),
        accepted_files=file_counts.get('accepted', 0),
        rejected_files=file_counts.get('rejected', 0),
        total_records=sum(record_counts.values()),
        pre_validation_failed=record_counts.get('pre_validation_failed', 0),
        record_rejected=record_counts.get('record_rejected', 0) + record_counts.get('file_rejected', 0),
        pending_amendment=record_counts.get('pre_validation_failed', 0) + 
                         record_counts.get('record_rejected', 0) + 
                         record_counts.get('file_rejected', 0)
    )


@router.get("/by-date", response_model=List[BusinessDateSummary])
async def get_submissions_by_date(
    days: int = Query(30, ge=1, le=90),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get submission summary grouped by business date."""
    from datetime import timedelta
    
    cutoff = date.today() - timedelta(days=days)
    
    # Get record counts by date and status
    results = db.query(
        models.RecordSubmission.business_date,
        models.RecordSubmission.status,
        func.count(models.RecordSubmission.id)
    ).filter(
        models.RecordSubmission.tenant_id == current_user.tenant_id,
        models.RecordSubmission.business_date >= cutoff
    ).group_by(
        models.RecordSubmission.business_date,
        models.RecordSubmission.status
    ).all()
    
    # Aggregate by date
    date_data = {}
    for biz_date, status, count in results:
        if biz_date not in date_data:
            date_data[biz_date] = {
                'total': 0, 'submitted': 0, 'accepted': 0,
                'rejected': 0, 'pending': 0
            }
        
        date_data[biz_date]['total'] += count
        
        if status == models.RecordStatus.ACCEPTED:
            date_data[biz_date]['accepted'] += count
        elif status == models.RecordStatus.SUBMITTED:
            date_data[biz_date]['submitted'] += count
        elif status in [
            models.RecordStatus.PRE_VALIDATION_FAILED,
            models.RecordStatus.FILE_REJECTED,
            models.RecordStatus.RECORD_REJECTED
        ]:
            date_data[biz_date]['rejected'] += count
            date_data[biz_date]['pending'] += count
        elif status == models.RecordStatus.AMENDED:
            date_data[biz_date]['pending'] += count
    
    return [
        BusinessDateSummary(
            business_date=biz_date,
            total_records=data['total'],
            submitted=data['submitted'],
            accepted=data['accepted'],
            rejected=data['rejected'],
            pending=data['pending'],
            is_complete=(data['pending'] == 0 and data['accepted'] > 0)
        )
        for biz_date, data in sorted(date_data.items(), reverse=True)
    ]
