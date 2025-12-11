from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from database import get_db
from services.auth import get_current_user
import models
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from croniter import croniter

router = APIRouter()

# === Pydantic Models ===

class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    report_id: UUID
    schedule_type: str = "CRON"  # CRON or CALENDAR
    cron_expression: Optional[str] = None
    is_active: bool = True
    parameters: Optional[dict] = {}

class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    schedule_type: Optional[str] = None
    cron_expression: Optional[str] = None
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
    is_active: bool
    next_run_at: Optional[datetime]
    last_run_at: Optional[datetime]
    last_run_status: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
    
    # Validate cron expression if provided
    if data.schedule_type.lower() == "cron":
        if not data.cron_expression:
            raise HTTPException(status_code=400, detail="Cron expression required for cron schedule type")
        if not validate_cron_expression(data.cron_expression):
            raise HTTPException(status_code=400, detail="Invalid cron expression")
    
    # Calculate next run time
    next_run = None
    if data.schedule_type.lower() == "cron" and data.cron_expression and data.is_active:
        next_run = calculate_next_run(data.cron_expression)
    
    # Create schedule
    schedule = models.Schedule(
        tenant_id=current_user.tenant_id,
        name=data.name,
        report_id=data.report_id,
        schedule_type=models.ScheduleType(data.schedule_type.lower()),
        cron_expression=data.cron_expression,
        is_active=data.is_active,
        next_run_at=next_run,
        parameters=data.parameters or {}
    )
    
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    
    return ScheduleResponse(
        id=schedule.id,
        tenant_id=schedule.tenant_id,
        name=schedule.name,
        report_id=schedule.report_id,
        report_name=report.name,
        schedule_type=schedule.schedule_type,
        cron_expression=schedule.cron_expression,
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
    if schedule.is_active and schedule.schedule_type == models.ScheduleType.CRON and schedule.cron_expression:
        schedule.next_run_at = calculate_next_run(schedule.cron_expression)
    else:
        schedule.next_run_at = None
    
    schedule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(schedule)
    
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
    
    db.delete(schedule)
    db.commit()
    
    return None
