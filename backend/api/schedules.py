from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from database import get_db
from services.auth import get_current_user, log_audit
import models
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone, timedelta, time as dt_time
from croniter import croniter
import pytz

router = APIRouter()


# === Calendar Config Model ===

class CalendarConfig(BaseModel):
    """Configuration for calendar-based scheduling"""
    frequency: str = Field(..., pattern="^(weekly|monthly|yearly)$")  # weekly, monthly, yearly
    time_slots: List[str] = ["09:00"]  # List of HH:MM times
    weekly_days: Optional[List[int]] = None  # 0=Mon, 1=Tue, ..., 6=Sun
    monthly_days: Optional[List[int]] = None  # 1-31
    yearly_dates: Optional[List[str]] = None  # MM-DD format
    exclusion_dates: List[str] = []  # YYYY-MM-DD format blackout dates
    timezone: str = "UTC"

# === Pydantic Models ===

class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    report_id: UUID
    schedule_type: str = "cron"  # cron or calendar
    cron_expression: Optional[str] = None
    calendar_config: Optional[CalendarConfig] = None
    is_active: bool = True
    parameters: Optional[dict] = {}

class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    schedule_type: Optional[str] = None
    cron_expression: Optional[str] = None
    calendar_config: Optional[CalendarConfig] = None
    is_active: Optional[bool] = None
    parameters: Optional[dict] = None

class ScheduleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    report_id: UUID
    report_name: str
    schedule_type: str
    cron_expression: Optional[str]
    calendar_config: Optional[dict] = None
    is_active: bool
    next_run_at: Optional[datetime]
    last_run_at: Optional[datetime]
    last_run_status: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SchedulePreview(BaseModel):
    """Preview of upcoming scheduled runs"""
    upcoming_runs: List[datetime]
    next_blackout: Optional[datetime] = None


# === Helper Functions ===

def validate_cron_expression(cron_expr: str) -> bool:
    """Validate cron expression format"""
    try:
        croniter(cron_expr)
        return True
    except (ValueError, KeyError):
        return False

def calculate_next_run(cron_expr: str) -> Optional[datetime]:
    """Calculate next run time from cron expression"""
    try:
        cron = croniter(cron_expr, datetime.now(timezone.utc))
        return cron.get_next(datetime)
    except Exception:
        return None


def is_blackout_date(dt: datetime, exclusions: List[str]) -> bool:
    """Check if a date is in the blackout list"""
    date_str = dt.strftime("%Y-%m-%d")
    return date_str in exclusions


def calculate_next_run_calendar(config: dict) -> Optional[datetime]:
    """
    Calculate next run time from calendar config.
    
    Supports:
    - Weekly: runs on specific weekdays
    - Monthly: runs on specific days of month
    - Yearly: runs on specific dates
    - Multiple time slots per day
    - Blackout date exclusions
    """
    if not config:
        return None
    
    frequency = config.get("frequency", "weekly")
    time_slots = config.get("time_slots", ["09:00"])
    exclusions = config.get("exclusion_dates", [])
    tz_name = config.get("timezone", "UTC")
    
    try:
        tz = pytz.timezone(tz_name)
    except:
        tz = pytz.UTC
    
    now = datetime.now(tz)
    
    # Parse time slots
    times = []
    for slot in time_slots:
        try:
            h, m = map(int, slot.split(":"))
            times.append(dt_time(h, m))
        except:
            times.append(dt_time(9, 0))
    times.sort()
    
    # Generate candidate dates for next 60 days
    candidates = []
    
    for day_offset in range(60):
        check_date = now.date() + timedelta(days=day_offset)
        
        # Check if this date matches the frequency pattern
        matches = False
        
        if frequency == "weekly":
            weekly_days = config.get("weekly_days", [0, 1, 2, 3, 4])  # Mon-Fri default
            # Python weekday(): Monday=0, Sunday=6
            if check_date.weekday() in weekly_days:
                matches = True
                
        elif frequency == "monthly":
            monthly_days = config.get("monthly_days", [1])  # 1st of month default
            if check_date.day in monthly_days:
                matches = True
                
        elif frequency == "yearly":
            yearly_dates = config.get("yearly_dates", ["01-01"])  # Jan 1 default
            date_str = check_date.strftime("%m-%d")
            if date_str in yearly_dates:
                matches = True
        
        if matches:
            # Add all time slots for this date
            for t in times:
                candidate_dt = tz.localize(datetime.combine(check_date, t))
                # Must be in future and not blackout
                if candidate_dt > now and not is_blackout_date(candidate_dt, exclusions):
                    candidates.append(candidate_dt.astimezone(pytz.UTC))
    
    # Return earliest candidate
    if candidates:
        return min(candidates)
    return None


def get_upcoming_runs(config: dict, count: int = 5) -> List[datetime]:
    """
    Get the next N upcoming run times for a calendar config.
    Used for preview functionality.
    """
    if not config:
        return []
    
    frequency = config.get("frequency", "weekly")
    time_slots = config.get("time_slots", ["09:00"])
    exclusions = config.get("exclusion_dates", [])
    tz_name = config.get("timezone", "UTC")
    
    try:
        tz = pytz.timezone(tz_name)
    except:
        tz = pytz.UTC
    
    now = datetime.now(tz)
    
    # Parse time slots
    times = []
    for slot in time_slots:
        try:
            h, m = map(int, slot.split(":"))
            times.append(dt_time(h, m))
        except:
            times.append(dt_time(9, 0))
    times.sort()
    
    upcoming = []
    
    for day_offset in range(180):  # Look ahead 6 months
        if len(upcoming) >= count:
            break
            
        check_date = now.date() + timedelta(days=day_offset)
        
        matches = False
        
        if frequency == "weekly":
            weekly_days = config.get("weekly_days", [0, 1, 2, 3, 4])
            if check_date.weekday() in weekly_days:
                matches = True
        elif frequency == "monthly":
            monthly_days = config.get("monthly_days", [1])
            if check_date.day in monthly_days:
                matches = True
        elif frequency == "yearly":
            yearly_dates = config.get("yearly_dates", ["01-01"])
            date_str = check_date.strftime("%m-%d")
            if date_str in yearly_dates:
                matches = True
        
        if matches:
            for t in times:
                if len(upcoming) >= count:
                    break
                candidate_dt = tz.localize(datetime.combine(check_date, t))
                if candidate_dt > now:
                    # Include even if blackout, for display purposes
                    upcoming.append(candidate_dt.astimezone(pytz.UTC))
    
    return upcoming[:count]


# === API Endpoints ===

@router.get("", response_model=List[ScheduleResponse])
async def list_schedules(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all schedules for the current tenant"""
    schedules = db.query(models.Schedule).filter(
        models.Schedule.tenant_id == current_user.tenant_id
    ).all()
    
    # Hydrate with report names
    result = []
    for schedule in schedules:
        schedule_dict = {
            "id": schedule.id,
            "tenant_id": schedule.tenant_id,
            "name": schedule.name,
            "report_id": schedule.report_id,
            "report_name": schedule.report.name if schedule.report else "Unknown",
            "schedule_type": schedule.schedule_type.value if schedule.schedule_type else "cron",
            "cron_expression": schedule.cron_expression,
            "calendar_config": schedule.calendar_config,
            "is_active": schedule.is_active,
            "next_run_at": schedule.next_run_at,
            "last_run_at": schedule.last_run_at,
            "last_run_status": schedule.last_run_status,
            "created_at": schedule.created_at,
            "updated_at": schedule.updated_at,
        }
        result.append(ScheduleResponse(**schedule_dict))
    
    return result


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    data: ScheduleCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new schedule"""
    # Verify report exists and belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == data.report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    schedule_type = data.schedule_type.lower()
    
    # Validate based on schedule type
    if schedule_type == "cron":
        if not data.cron_expression:
            raise HTTPException(status_code=400, detail="Cron expression required for cron schedule type")
        if not validate_cron_expression(data.cron_expression):
            raise HTTPException(status_code=400, detail="Invalid cron expression")
    elif schedule_type == "calendar":
        if not data.calendar_config:
            raise HTTPException(status_code=400, detail="Calendar config required for calendar schedule type")
    
    # Calculate next run time
    next_run = None
    calendar_config_dict = None
    
    if data.is_active:
        if schedule_type == "cron" and data.cron_expression:
            next_run = calculate_next_run(data.cron_expression)
        elif schedule_type == "calendar" and data.calendar_config:
            calendar_config_dict = data.calendar_config.model_dump()
            next_run = calculate_next_run_calendar(calendar_config_dict)
    
    # Create schedule
    schedule = models.Schedule(
        tenant_id=current_user.tenant_id,
        name=data.name,
        report_id=data.report_id,
        schedule_type=models.ScheduleType(schedule_type),
        cron_expression=data.cron_expression,
        calendar_config=calendar_config_dict,
        is_active=data.is_active,
        next_run_at=next_run,
        parameters=data.parameters or {}
    )
    
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    log_audit(db, current_user, models.AuditAction.CREATE, "Schedule", str(schedule.id),
              changes={"name": data.name, "report_id": str(data.report_id), "schedule_type": schedule_type})

    return ScheduleResponse(
        id=schedule.id,
        tenant_id=schedule.tenant_id,
        name=schedule.name,
        report_id=schedule.report_id,
        report_name=report.name,
        schedule_type=schedule.schedule_type.value,
        cron_expression=schedule.cron_expression,
        calendar_config=schedule.calendar_config,
        is_active=schedule.is_active,
        next_run_at=schedule.next_run_at,
        last_run_at=schedule.last_run_at,
        last_run_status=schedule.last_run_status,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at
    )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific schedule"""
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.tenant_id == current_user.tenant_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return ScheduleResponse(
        id=schedule.id,
        tenant_id=schedule.tenant_id,
        name=schedule.name,
        report_id=schedule.report_id,
        report_name=schedule.report.name if schedule.report else "Unknown",
        schedule_type=schedule.schedule_type,
        cron_expression=schedule.cron_expression,
        is_active=schedule.is_active,
        next_run_at=schedule.next_run_at,
        last_run_at=schedule.last_run_at,
        last_run_status=schedule.last_run_status,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at
    )


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    data: ScheduleUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a schedule"""
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.tenant_id == current_user.tenant_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Update fields
    if data.name is not None:
        schedule.name = data.name
    if data.schedule_type is not None:
        schedule.schedule_type = models.ScheduleType(data.schedule_type.lower())
    if data.cron_expression is not None:
        if not validate_cron_expression(data.cron_expression):
            raise HTTPException(status_code=400, detail="Invalid cron expression")
        schedule.cron_expression = data.cron_expression
    if data.is_active is not None:
        schedule.is_active = data.is_active
    if data.parameters is not None:
        schedule.parameters = data.parameters
    
    # Recalculate next run if needed
    if schedule.is_active and schedule.schedule_type == models.ScheduleType.CRON and schedule.cron_expression:
        schedule.next_run_at = calculate_next_run(schedule.cron_expression)
    else:
        schedule.next_run_at = None
    
    schedule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)

    update_data = data.model_dump(exclude_unset=True)
    log_audit(db, current_user, models.AuditAction.UPDATE, "Schedule", str(schedule.id),
              changes={k: v for k, v in update_data.items() if v is not None})

    return ScheduleResponse(
        id=schedule.id,
        tenant_id=schedule.tenant_id,
        name=schedule.name,
        report_id=schedule.report_id,
        report_name=schedule.report.name if schedule.report else "Unknown",
        schedule_type=schedule.schedule_type,
        cron_expression=schedule.cron_expression,
        is_active=schedule.is_active,
        next_run_at=schedule.next_run_at,
        last_run_at=schedule.last_run_at,
        last_run_status=schedule.last_run_status,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at
    )


@router.put("/{schedule_id}/toggle", response_model=ScheduleResponse)
async def toggle_schedule(
    schedule_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle schedule active status (pause/resume)"""
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.tenant_id == current_user.tenant_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Toggle active status
    schedule.is_active = not schedule.is_active
    
    # Update next run time
    if schedule.is_active:
        if schedule.schedule_type == models.ScheduleType.CRON and schedule.cron_expression:
            schedule.next_run_at = calculate_next_run(schedule.cron_expression)
        elif schedule.schedule_type == models.ScheduleType.CALENDAR and schedule.calendar_config:
            schedule.next_run_at = calculate_next_run_calendar(schedule.calendar_config)
        else:
            schedule.next_run_at = None
    else:
        schedule.next_run_at = None
    
    schedule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)

    log_audit(db, current_user, models.AuditAction.UPDATE, "Schedule", str(schedule.id),
              changes={"is_active": schedule.is_active})

    return ScheduleResponse(
        id=schedule.id,
        tenant_id=schedule.tenant_id,
        name=schedule.name,
        report_id=schedule.report_id,
        report_name=schedule.report.name if schedule.report else "Unknown",
        schedule_type=schedule.schedule_type.value,
        cron_expression=schedule.cron_expression,
        calendar_config=schedule.calendar_config,
        is_active=schedule.is_active,
        next_run_at=schedule.next_run_at,
        last_run_at=schedule.last_run_at,
        last_run_status=schedule.last_run_status,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at
    )


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a schedule"""
    schedule = db.query(models.Schedule).filter(
        models.Schedule.id == schedule_id,
        models.Schedule.tenant_id == current_user.tenant_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    schedule_id_str = str(schedule.id)
    log_audit(db, current_user, models.AuditAction.DELETE, "Schedule", schedule_id_str)

    db.delete(schedule)
    db.commit()

    return None


@router.post("/preview", response_model=SchedulePreview)
async def preview_schedule(
    config: CalendarConfig,
    count: int = 10,
    current_user: models.User = Depends(get_current_user)
):
    """
    Preview upcoming run times for a calendar configuration.
    
    Use this to show users when their schedule will run before they save it.
    Returns the next N scheduled runs, including any that fall on blackout dates
    (so the UI can show them crossed out).
    """
    config_dict = config.model_dump()
    upcoming = get_upcoming_runs(config_dict, count)
    
    # Find first blackout date in upcoming runs
    next_blackout = None
    exclusions = config.exclusion_dates or []
    for dt in upcoming:
        if is_blackout_date(dt, exclusions):
            next_blackout = dt
            break
    
    return SchedulePreview(
        upcoming_runs=upcoming,
        next_blackout=next_blackout
    )
