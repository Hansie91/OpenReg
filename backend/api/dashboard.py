"""
Dashboard API

Provides unified dashboard view with daily report summaries, 
scheduling status, and submission statistics.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta, timezone
from uuid import UUID

from database import get_db
from services.auth import get_current_user
import models

router = APIRouter()


# === Helper Functions ===

def get_previous_business_date(reference_date: date = None) -> date:
    """
    Calculate the previous business date (T-1), skipping weekends.
    
    Args:
        reference_date: The date to calculate from (defaults to today)
    
    Returns:
        The previous business date
    """
    if reference_date is None:
        reference_date = date.today()
    
    prev_date = reference_date - timedelta(days=1)
    
    # Skip weekends (Saturday=5, Sunday=6)
    while prev_date.weekday() >= 5:
        prev_date = prev_date - timedelta(days=1)
    
    return prev_date


def is_business_date(check_date: date) -> bool:
    """Check if a date is a business day (weekday)"""
    return check_date.weekday() < 5


# === Pydantic Response Models ===

class ScheduledReportSummary(BaseModel):
    """Summary of a scheduled report execution for a given date"""
    report_id: UUID
    report_name: str
    schedule_id: Optional[UUID] = None
    schedule_name: Optional[str] = None
    cron_expression: Optional[str] = None
    next_run_at: Optional[datetime] = None  # When the next run is scheduled
    job_run_id: Optional[UUID] = None
    status: str  # pending, running, success, failed, partial
    triggered_by: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    artifact_id: Optional[str] = None
    filename: Optional[str] = None
    error_message: Optional[str] = None


class FileSubmissionSummary(BaseModel):
    """Summary of a file submission"""
    file_id: UUID
    file_name: str
    status: str
    record_count: int
    accepted_count: int
    rejected_count: int
    submitted_at: Optional[datetime] = None


class SubmissionStats(BaseModel):
    """Aggregated submission statistics for a business date"""
    total_records: int
    records_submitted: int
    records_accepted: int
    records_rejected: int
    pre_validation_failed: int
    file_rejections: int
    record_rejections: int
    file_submissions: List[FileSubmissionSummary]


class PendingSchedule(BaseModel):
    """A schedule that is expected to run but hasn't yet"""
    schedule_id: UUID
    schedule_name: str
    report_id: UUID
    report_name: str
    next_run_at: Optional[datetime] = None
    cron_expression: Optional[str] = None


class DailySummaryResponse(BaseModel):
    """Complete daily summary response"""
    business_date: date
    is_previous_business_date: bool
    scheduled_reports: List[ScheduledReportSummary]
    submission_stats: SubmissionStats
    pending_schedules: List[PendingSchedule]
    summary: Dict[str, int]  # Quick stats: total_runs, success, failed, pending


# === API Endpoints ===

@router.get("/daily-summary", response_model=DailySummaryResponse)
async def get_daily_summary(
    business_date: Optional[date] = Query(
        None, 
        description="Business date to get summary for (defaults to previous business date)"
    ),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a comprehensive daily summary for the dashboard.
    
    Includes:
    - Scheduled reports and their execution status
    - Submission statistics (records sent, accepted, rejected)
    - Pending schedules that should run today
    """
    # Default to previous business date if not specified
    if business_date is None:
        business_date = get_previous_business_date()
    
    is_prev_biz_date = (business_date == get_previous_business_date())
    
    tenant_id = current_user.tenant_id
    
    # === Get all schedules with their reports ===
    # 1. Get legacy schedules from Schedule table
    schedules = db.query(models.Schedule).filter(
        models.Schedule.tenant_id == tenant_id,
        models.Schedule.is_active == True
    ).all()

    # 2. Get reports with embedded schedules in their operational_config
    reports_with_embedded_schedule = []
    all_reports = db.query(models.Report).filter(
        models.Report.tenant_id == tenant_id,
        models.Report.is_active == True
    ).all()

    for report in all_reports:
        # Schedule is now stored in operational_config on Report (not versioned)
        op_config = report.operational_config or {}
        schedule_config = op_config.get('schedule', {})

        # Also check version.config for backwards compatibility (migration)
        if not schedule_config and report.current_version_id:
            version = db.query(models.ReportVersion).filter(
                models.ReportVersion.id == report.current_version_id
            ).first()
            if version and version.config:
                schedule_config = version.config.get('schedule', {})

        if schedule_config:
            # Schedule is enabled if:
            # 1. enabled is explicitly True, OR
            # 2. enabled is not explicitly False AND there's a cron/calendar config
            is_enabled = schedule_config.get('enabled')
            has_schedule_config = bool(schedule_config.get('cron') or schedule_config.get('calendar'))

            # If enabled is not explicitly False and there's schedule config, treat as enabled
            schedule_active = (is_enabled == True) or (is_enabled is None and has_schedule_config)

            if schedule_active:
                reports_with_embedded_schedule.append({
                    'report': report,
                    'schedule_config': schedule_config
                })
    
    # === Get job runs for the business date ===
    # We look for runs created on the business date (or the day after for EOD runs)
    date_start = datetime.combine(business_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    date_end = datetime.combine(business_date + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
    
    job_runs = db.query(models.JobRun).filter(
        models.JobRun.tenant_id == tenant_id,
        models.JobRun.created_at >= date_start,
        models.JobRun.created_at < date_end
    ).all()
    
    # Build a map of report_version_id -> job_run for quick lookup
    run_by_version = {}
    for run in job_runs:
        run_by_version[run.report_version_id] = run
    
    # === Build scheduled reports list ===
    scheduled_reports = []
    seen_report_ids = set()  # Avoid duplicates if report has both legacy and embedded schedule

    # 1. Process legacy schedules
    for schedule in schedules:
        report = schedule.report
        if not report:
            continue

        seen_report_ids.add(report.id)

        # Find job runs for this report on the business date
        report_versions = db.query(models.ReportVersion.id).filter(
            models.ReportVersion.report_id == report.id
        ).all()
        version_ids = [v[0] for v in report_versions]

        # Find matching job run
        matching_run = None
        for vid in version_ids:
            if vid in run_by_version:
                matching_run = run_by_version[vid]
                break

        # Get artifact info if run exists
        artifact_id = None
        filename = None
        if matching_run:
            artifact = db.query(models.Artifact).filter(
                models.Artifact.job_run_id == matching_run.id
            ).first()
            if artifact:
                artifact_id = str(artifact.id)
                filename = artifact.filename

        # Calculate duration
        duration = None
        if matching_run and matching_run.started_at and matching_run.ended_at:
            duration = (matching_run.ended_at - matching_run.started_at).total_seconds()

        scheduled_reports.append(ScheduledReportSummary(
            report_id=report.id,
            report_name=report.name,
            schedule_id=schedule.id,
            schedule_name=schedule.name,
            cron_expression=schedule.cron_expression,
            next_run_at=schedule.next_run_at if not matching_run else None,
            job_run_id=matching_run.id if matching_run else None,
            status=matching_run.status.value if matching_run else "not_run",
            triggered_by=matching_run.triggered_by.value if matching_run else None,
            created_at=matching_run.created_at if matching_run else None,
            started_at=matching_run.started_at if matching_run else None,
            ended_at=matching_run.ended_at if matching_run else None,
            duration_seconds=duration,
            artifact_id=artifact_id,
            filename=filename,
            error_message=matching_run.error_message if matching_run else None
        ))

    # 2. Process embedded schedules (from report config)
    for item in reports_with_embedded_schedule:
        report = item['report']
        schedule_config = item['schedule_config']

        # Skip if already processed via legacy schedule
        if report.id in seen_report_ids:
            continue

        # Get cron expression from config
        cron_expr = None
        if schedule_config.get('type') == 'cron' or not schedule_config.get('type'):
            cron_expr = schedule_config.get('cron')
        elif schedule_config.get('type') == 'calendar':
            # Build a human-readable description for calendar schedules
            cal = schedule_config.get('calendar', {})
            freq = cal.get('frequency', 'daily')
            times = cal.get('times', ['06:00'])
            cron_expr = f"Calendar: {freq} at {', '.join(times)}"

        # Find job runs for this report on the business date
        report_versions = db.query(models.ReportVersion.id).filter(
            models.ReportVersion.report_id == report.id
        ).all()
        version_ids = [v[0] for v in report_versions]

        # Find matching job run
        matching_run = None
        for vid in version_ids:
            if vid in run_by_version:
                matching_run = run_by_version[vid]
                break

        # Get artifact info if run exists
        artifact_id = None
        filename = None
        if matching_run:
            artifact = db.query(models.Artifact).filter(
                models.Artifact.job_run_id == matching_run.id
            ).first()
            if artifact:
                artifact_id = str(artifact.id)
                filename = artifact.filename

        # Calculate duration
        duration = None
        if matching_run and matching_run.started_at and matching_run.ended_at:
            duration = (matching_run.ended_at - matching_run.started_at).total_seconds()

        scheduled_reports.append(ScheduledReportSummary(
            report_id=report.id,
            report_name=report.name,
            schedule_id=None,  # Embedded schedule has no separate ID
            schedule_name="Embedded Schedule",
            cron_expression=cron_expr,
            job_run_id=matching_run.id if matching_run else None,
            status=matching_run.status.value if matching_run else "not_run",
            triggered_by=matching_run.triggered_by.value if matching_run else None,
            created_at=matching_run.created_at if matching_run else None,
            started_at=matching_run.started_at if matching_run else None,
            ended_at=matching_run.ended_at if matching_run else None,
            duration_seconds=duration,
            artifact_id=artifact_id,
            filename=filename,
            error_message=matching_run.error_message if matching_run else None
        ))
    
    # === Get submission stats for the business date ===
    file_submissions = db.query(models.FileSubmission).filter(
        models.FileSubmission.tenant_id == tenant_id,
        models.FileSubmission.business_date == business_date
    ).all()
    
    file_submission_summaries = []
    total_accepted = 0
    total_rejected = 0
    file_rejections = 0
    
    for fs in file_submissions:
        # Count accepted/rejected records for this file
        accepted = db.query(models.RecordSubmission).filter(
            models.RecordSubmission.file_submission_id == fs.id,
            models.RecordSubmission.status == models.RecordStatus.ACCEPTED
        ).count()
        
        rejected = db.query(models.RecordSubmission).filter(
            models.RecordSubmission.file_submission_id == fs.id,
            models.RecordSubmission.status.in_([
                models.RecordStatus.FILE_REJECTED,
                models.RecordStatus.RECORD_REJECTED
            ])
        ).count()
        
        if fs.status == models.FileSubmissionStatus.REJECTED:
            file_rejections += 1
        
        total_accepted += accepted
        total_rejected += rejected
        
        file_submission_summaries.append(FileSubmissionSummary(
            file_id=fs.id,
            file_name=fs.file_name,
            status=fs.status.value,
            record_count=fs.record_count,
            accepted_count=accepted,
            rejected_count=rejected,
            submitted_at=fs.submitted_at
        ))
    
    # Get record-level stats
    record_stats = db.query(
        models.RecordSubmission.status,
        func.count(models.RecordSubmission.id)
    ).filter(
        models.RecordSubmission.tenant_id == tenant_id,
        models.RecordSubmission.business_date == business_date
    ).group_by(models.RecordSubmission.status).all()
    
    status_counts = {status.value: count for status, count in record_stats}
    
    total_records = sum(status_counts.values())
    pre_validation_failed = status_counts.get('pre_validation_failed', 0)
    records_submitted = status_counts.get('submitted', 0) + status_counts.get('accepted', 0) + \
                       status_counts.get('file_rejected', 0) + status_counts.get('record_rejected', 0)
    record_rejections = status_counts.get('record_rejected', 0)
    
    submission_stats = SubmissionStats(
        total_records=total_records,
        records_submitted=records_submitted,
        records_accepted=total_accepted,
        records_rejected=total_rejected,
        pre_validation_failed=pre_validation_failed,
        file_rejections=file_rejections,
        record_rejections=record_rejections,
        file_submissions=file_submission_summaries
    )
    
    # === Get upcoming schedules (next 7 days) ===
    pending_schedules = []
    now = datetime.now(timezone.utc)
    seven_days_later = now + timedelta(days=7)

    # Query all active schedules with next_run_at in the future (next 7 days)
    upcoming_schedules = db.query(models.Schedule).filter(
        models.Schedule.tenant_id == current_user.tenant_id,
        models.Schedule.is_active == True,
        models.Schedule.next_run_at != None,
        models.Schedule.next_run_at > now,
        models.Schedule.next_run_at <= seven_days_later
    ).order_by(models.Schedule.next_run_at).limit(10).all()

    for schedule in upcoming_schedules:
        pending_schedules.append(PendingSchedule(
            schedule_id=schedule.id,
            schedule_name=schedule.name,
            report_id=schedule.report_id,
            report_name=schedule.report.name if schedule.report else "Unknown",
            next_run_at=schedule.next_run_at,
            cron_expression=schedule.cron_expression
        ))
    
    # === Calculate summary stats ===
    run_statuses = [r.status for r in scheduled_reports if r.job_run_id]
    summary = {
        "total_scheduled": len(scheduled_reports),
        "executed": len([s for s in scheduled_reports if s.job_run_id]),
        "success": len([s for s in scheduled_reports if s.status == "success"]),
        "failed": len([s for s in scheduled_reports if s.status == "failed"]),
        "running": len([s for s in scheduled_reports if s.status == "running"]),
        "pending": len(pending_schedules)
    }
    
    return DailySummaryResponse(
        business_date=business_date,
        is_previous_business_date=is_prev_biz_date,
        scheduled_reports=scheduled_reports,
        submission_stats=submission_stats,
        pending_schedules=pending_schedules,
        summary=summary
    )


@router.get("/previous-business-date")
async def get_prev_business_date(
    reference_date: Optional[date] = Query(None, description="Reference date (defaults to today)"),
    current_user: models.User = Depends(get_current_user)
):
    """Get the previous business date from a reference date"""
    ref = reference_date or date.today()
    return {
        "reference_date": ref,
        "previous_business_date": get_previous_business_date(ref),
        "is_reference_business_day": is_business_date(ref)
    }
