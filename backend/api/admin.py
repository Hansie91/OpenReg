"""Admin API endpoints for user management and audit logging"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user
import models

router = APIRouter()


# === Pydantic Schemas ===

class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    user_email: Optional[str]
    user_name: Optional[str]
    entity_type: str
    entity_id: Optional[UUID]
    action: str
    changes: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditStatsResponse(BaseModel):
    total_count: int
    by_entity_type: Dict[str, int]
    by_action: Dict[str, int]
    recent_activity: List[Dict[str, Any]]


# === User Management ===

@router.get("/users")
async def list_users(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List users - TODO: Implement full user management"""
    return []


# === Audit Logs ===

@router.get("/audit", response_model=Dict[str, Any])
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List audit logs with filtering and pagination.
    
    Filters:
    - entity_type: Filter by entity type (Report, Connector, User, etc.)
    - action: Filter by action (create, update, delete, execute)
    - user_id: Filter by user who performed the action
    - from_date: Filter logs created after this date
    - to_date: Filter logs created before this date
    """
    # Build query
    query = db.query(models.AuditLog).filter(
        models.AuditLog.tenant_id == current_user.tenant_id
    )
    
    # Apply filters
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    
    if action:
        query = query.filter(models.AuditLog.action == action)
    
    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)
    
    if from_date:
        query = query.filter(models.AuditLog.created_at >= from_date)
    
    if to_date:
        query = query.filter(models.AuditLog.created_at <= to_date)
    
    # Get total count
    total_count = query.count()
    
    # Execute query with pagination
    audit_logs = query.order_by(
        models.AuditLog.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Join with user data and format response
    results = []
    for log in audit_logs:
        user = db.query(models.User).filter(models.User.id == log.user_id).first() if log.user_id else None
        
        results.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": user.email if user else None,
            "user_name": user.full_name if user else None,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "action": log.action.value,
            "changes": log.changes,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at,
        })
    
    return {
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "data": results
    }


@router.get("/audit/stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get audit log statistics and breakdowns"""
    
    # Total count
    total_count = db.query(models.AuditLog).filter(
        models.AuditLog.tenant_id == current_user.tenant_id
    ).count()
    
    # Breakdown by entity type
    entity_type_counts = db.query(
        models.AuditLog.entity_type,
        func.count(models.AuditLog.id).label('count')
    ).filter(
        models.AuditLog.tenant_id == current_user.tenant_id
    ).group_by(
        models.AuditLog.entity_type
    ).all()
    
    by_entity_type = {et: count for et, count in entity_type_counts}
    
    # Breakdown by action
    action_counts = db.query(
        models.AuditLog.action,
        func.count(models.AuditLog.id).label('count')
    ).filter(
        models.AuditLog.tenant_id == current_user.tenant_id
    ).group_by(
        models.AuditLog.action
    ).all()
    
    by_action = {action.value: count for action, count in action_counts}
    
    # Recent activity (last 10 actions)
    recent_logs = db.query(models.AuditLog).filter(
        models.AuditLog.tenant_id == current_user.tenant_id
    ).order_by(
        models.AuditLog.created_at.desc()
    ).limit(10).all()
    
    recent_activity = []
    for log in recent_logs:
        user = db.query(models.User).filter(models.User.id == log.user_id).first() if log.user_id else None
        recent_activity.append({
            "action": log.action.value,
            "entity_type": log.entity_type,
            "user_email": user.email if user else "System",
            "timestamp": log.created_at.isoformat()
        })
    
    return AuditStatsResponse(
        total_count=total_count,
        by_entity_type=by_entity_type,
        by_action=by_action,
        recent_activity=recent_activity
    )
