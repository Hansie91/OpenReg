"""Admin API endpoints for user management and audit logging"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user, require_admin, log_audit
import models

router = APIRouter()


# === Pydantic Schemas ===

class RoleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    permissions: List[str]
    user_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    is_active: bool
    is_superuser: bool
    role_id: Optional[UUID] = None
    role_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    is_superuser: bool = False
    role_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    password: Optional[str] = None
    role_id: Optional[UUID] = None


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
    """List all users in the tenant with their roles. Available to all authenticated users."""
    users = db.query(models.User).filter(
        models.User.tenant_id == current_user.tenant_id
    ).order_by(models.User.created_at.desc()).all()
    
    # Enrich with role info
    results = []
    for user in users:
        # Get user's primary role (first one if multiple)
        user_role = db.query(models.UserRole).filter(
            models.UserRole.user_id == user.id
        ).first()
        role = None
        if user_role:
            role = db.query(models.Role).filter(models.Role.id == user_role.role_id).first()
        
        results.append({
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "role_id": role.id if role else None,
            "role_name": role.name if role else None,
            "created_at": user.created_at
        })
    
    return results


@router.get("/users/me")
async def get_current_user_info(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's info including admin status and role"""
    # Get role
    user_role = db.query(models.UserRole).filter(
        models.UserRole.user_id == current_user.id
    ).first()
    role = None
    if user_role:
        role = db.query(models.Role).filter(models.Role.id == user_role.role_id).first()
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "role_id": role.id if role else None,
        "role_name": role.name if role else None,
        "created_at": current_user.created_at
    }


@router.post("/users")
async def create_user(
    user_data: UserCreate,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new user with optional role. Admin only."""
    from services.auth import hash_password
    
    # Check if email already exists
    existing = db.query(models.User).filter(
        models.User.email == user_data.email,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role if provided and check if it's Administrator
    role = None
    is_admin_role = False
    if user_data.role_id:
        role = db.query(models.Role).filter(
            models.Role.id == user_data.role_id,
            models.Role.tenant_id == current_user.tenant_id
        ).first()
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role")
        is_admin_role = role.name.lower() == "administrator"
    
    # Set is_superuser based on role (true if Administrator role)
    new_user = models.User(
        tenant_id=current_user.tenant_id,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        is_superuser=is_admin_role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Assign role if provided
    role_name = None
    if user_data.role_id:
        user_role = models.UserRole(
            user_id=new_user.id,
            role_id=user_data.role_id
        )
        db.add(user_role)
        db.commit()
        role = db.query(models.Role).filter(models.Role.id == user_data.role_id).first()
        role_name = role.name if role else None
    
    # Audit log
    log_audit(
        db=db,
        user=current_user,
        action=models.AuditAction.CREATE,
        entity_type="user",
        entity_id=str(new_user.id),
        changes={"email": new_user.email, "full_name": new_user.full_name, "role": role_name, "is_superuser": new_user.is_superuser}
    )
    
    return {
        "id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "is_active": new_user.is_active,
        "is_superuser": new_user.is_superuser,
        "role_id": user_data.role_id,
        "role_name": role_name,
        "created_at": new_user.created_at
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a user including role assignment. Admin only."""
    from services.auth import hash_password
    
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent demoting the last admin
    if user_data.is_superuser is False and user.is_superuser:
        admin_count = db.query(models.User).filter(
            models.User.tenant_id == current_user.tenant_id,
            models.User.is_superuser == True,
            models.User.is_active == True
        ).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove admin status: At least one administrator must exist"
            )
    
    # Update basic fields
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.is_superuser is not None:
        user.is_superuser = user_data.is_superuser
    if user_data.password is not None:
        user.hashed_password = hash_password(user_data.password)
    
    # Update role if provided
    if user_data.role_id is not None:
        # Remove existing role assignments
        db.query(models.UserRole).filter(models.UserRole.user_id == user.id).delete()
        
        # Add new role if specified
        if user_data.role_id:
            role = db.query(models.Role).filter(
                models.Role.id == user_data.role_id,
                models.Role.tenant_id == current_user.tenant_id
            ).first()
            if not role:
                raise HTTPException(status_code=400, detail="Invalid role")
            
            # Auto-set is_superuser based on Administrator role
            is_admin_role = role.name.lower() == "administrator"
            user.is_superuser = is_admin_role
            
            user_role = models.UserRole(
                user_id=user.id,
                role_id=user_data.role_id
            )
            db.add(user_role)
        else:
            # No role assigned - remove admin status
            user.is_superuser = False
    
    db.commit()
    db.refresh(user)
    
    # Get updated role info
    user_role = db.query(models.UserRole).filter(
        models.UserRole.user_id == user.id
    ).first()
    role = None
    role_name = None
    if user_role:
        role = db.query(models.Role).filter(models.Role.id == user_role.role_id).first()
        role_name = role.name if role else None
    
    # Audit log
    log_audit(
        db=db,
        user=current_user,
        action=models.AuditAction.UPDATE,
        entity_type="user",
        entity_id=str(user.id),
        changes={"email": user.email, "full_name": user.full_name, "role": role_name, "is_superuser": user.is_superuser, "is_active": user.is_active}
    )
    
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "role_id": role.id if role else None,
        "role_name": role_name,
        "created_at": user.created_at
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a user. Admin only. Cannot delete last admin."""
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Prevent deleting the last admin
    if user.is_superuser:
        admin_count = db.query(models.User).filter(
            models.User.tenant_id == current_user.tenant_id,
            models.User.is_superuser == True,
            models.User.is_active == True
        ).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete last administrator"
            )
    
    # Capture user info before deletion for audit log
    deleted_user_email = user.email
    deleted_user_id = str(user.id)
    
    db.delete(user)
    db.commit()
    
    # Audit log
    log_audit(
        db=db,
        user=current_user,
        action=models.AuditAction.DELETE,
        entity_type="user",
        entity_id=deleted_user_id,
        changes={"email": deleted_user_email}
    )
    
    return {"message": "User deleted successfully"}


# === Role Management ===

@router.get("/roles")
async def list_roles(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all roles in the tenant."""
    roles = db.query(models.Role).filter(
        models.Role.tenant_id == current_user.tenant_id
    ).order_by(models.Role.name).all()
    
    results = []
    for role in roles:
        user_count = db.query(models.UserRole).filter(
            models.UserRole.role_id == role.id
        ).count()
        results.append({
            "id": role.id,
            "name": role.name,
            "description": role.description,
            "permissions": role.permissions or [],
            "user_count": user_count,
            "created_at": role.created_at
        })
    
    return results


@router.post("/roles")
async def create_role(
    role_data: RoleCreate,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new role. Admin only."""
    # Check if name already exists
    existing = db.query(models.Role).filter(
        models.Role.name == role_data.name,
        models.Role.tenant_id == current_user.tenant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")
    
    new_role = models.Role(
        tenant_id=current_user.tenant_id,
        name=role_data.name,
        description=role_data.description,
        permissions=role_data.permissions
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    
    # Audit log
    log_audit(
        db=db,
        user=current_user,
        action=models.AuditAction.CREATE,
        entity_type="role",
        entity_id=str(new_role.id),
        changes={"name": new_role.name, "permissions": new_role.permissions}
    )
    
    return {
        "id": new_role.id,
        "name": new_role.name,
        "description": new_role.description,
        "permissions": new_role.permissions or [],
        "user_count": 0,
        "created_at": new_role.created_at
    }


@router.put("/roles/{role_id}")
async def update_role(
    role_id: UUID,
    role_data: RoleUpdate,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a role. Admin only."""
    role = db.query(models.Role).filter(
        models.Role.id == role_id,
        models.Role.tenant_id == current_user.tenant_id
    ).first()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role_data.name is not None:
        # Check for name conflict
        existing = db.query(models.Role).filter(
            models.Role.name == role_data.name,
            models.Role.tenant_id == current_user.tenant_id,
            models.Role.id != role_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Role name already exists")
        role.name = role_data.name
    
    if role_data.description is not None:
        role.description = role_data.description
    if role_data.permissions is not None:
        role.permissions = role_data.permissions
    
    db.commit()
    db.refresh(role)
    
    user_count = db.query(models.UserRole).filter(
        models.UserRole.role_id == role.id
    ).count()
    
    # Audit log
    log_audit(
        db=db,
        user=current_user,
        action=models.AuditAction.UPDATE,
        entity_type="role",
        entity_id=str(role.id),
        changes={"name": role.name, "permissions": role.permissions}
    )
    
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "permissions": role.permissions or [],
        "user_count": user_count,
        "created_at": role.created_at
    }


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: UUID,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a role. Admin only. Removes role from all assigned users."""
    role = db.query(models.Role).filter(
        models.Role.id == role_id,
        models.Role.tenant_id == current_user.tenant_id
    ).first()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Prevent deletion of Administrator role
    if role.name.lower() == "administrator":
        raise HTTPException(status_code=400, detail="Cannot delete the Administrator role")
    
    # Capture role info before deletion for audit log
    deleted_role_name = role.name
    deleted_role_id = str(role.id)
    
    # Delete user-role assignments first
    db.query(models.UserRole).filter(models.UserRole.role_id == role_id).delete()
    
    db.delete(role)
    db.commit()
    
    # Audit log
    log_audit(
        db=db,
        user=current_user,
        action=models.AuditAction.DELETE,
        entity_type="role",
        entity_id=deleted_role_id,
        changes={"name": deleted_role_name}
    )
    
    return {"message": "Role deleted successfully"}


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


# === System Health ===

@router.get("/health")
async def get_system_health(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get system health status including:
    - Database connection status
    - Entity counts (reports, connectors, users, etc.)
    - Recent job run statistics
    - Streaming buffer status
    - CPU and memory usage
    """
    import time
    from datetime import timedelta
    
    health = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "system": {},
        "database": {},
        "entities": {},
        "jobs": {},
        "streaming": {}
    }
    
    # System metrics (CPU, Memory, Disk)
    try:
        import os
        import psutil
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        # Use appropriate disk path for OS
        disk_path = 'C:/' if os.name == 'nt' else '/'
        disk = psutil.disk_usage(disk_path)
        
        health["system"] = {
            "cpu_percent": cpu_percent,
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_total_gb": round(memory.total / (1024**3), 2),
            "memory_percent": memory.percent,
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "disk_percent": disk.percent
        }
    except Exception as e:
        health["system"] = {"error": str(e)}
    
    # Database health
    try:
        from sqlalchemy import text
        start = time.time()
        db.execute(text("SELECT 1"))
        db_latency = (time.time() - start) * 1000
        health["database"] = {
            "status": "connected",
            "latency_ms": round(db_latency, 2)
        }
    except Exception as e:
        health["database"] = {"status": "error", "error": str(e)}
        health["status"] = "degraded"
    
    # Entity counts
    try:
        health["entities"] = {
            "reports": db.query(models.Report).filter(
                models.Report.tenant_id == current_user.tenant_id
            ).count(),
            "connectors": db.query(models.Connector).filter(
                models.Connector.tenant_id == current_user.tenant_id
            ).count(),
            "users": db.query(models.User).filter(
                models.User.tenant_id == current_user.tenant_id
            ).count(),
            "schedules": db.query(models.Schedule).filter(
                models.Schedule.tenant_id == current_user.tenant_id
            ).count(),
            "validation_rules": db.query(models.ValidationRule).filter(
                models.ValidationRule.tenant_id == current_user.tenant_id
            ).count()
        }
    except Exception as e:
        health["entities"] = {"error": str(e)}
    
    # Job run statistics (last 24 hours)
    try:
        yesterday = datetime.utcnow() - timedelta(hours=24)
        
        job_stats = db.query(
            models.JobRun.status,
            func.count(models.JobRun.id).label('count')
        ).filter(
            models.JobRun.tenant_id == current_user.tenant_id,
            models.JobRun.created_at >= yesterday
        ).group_by(models.JobRun.status).all()
        
        total_jobs = sum(count for _, count in job_stats)
        jobs_by_status = {status.value: count for status, count in job_stats}
        
        # Average duration for completed jobs
        avg_duration = db.query(
            func.avg(models.JobRun.duration_ms)
        ).filter(
            models.JobRun.tenant_id == current_user.tenant_id,
            models.JobRun.status == models.JobRunStatus.SUCCESS,
            models.JobRun.created_at >= yesterday
        ).scalar()
        
        health["jobs"] = {
            "last_24h_total": total_jobs,
            "by_status": jobs_by_status,
            "avg_duration_ms": round(avg_duration, 0) if avg_duration else None
        }
    except Exception as e:
        health["jobs"] = {"error": str(e)}
    
    # Streaming buffer status
    try:
        topics = db.query(models.StreamingTopic).filter(
            models.StreamingTopic.tenant_id == current_user.tenant_id,
            models.StreamingTopic.is_active == True
        ).all()
        
        streaming_stats = []
        for topic in topics:
            pending = db.query(models.StreamingBuffer).filter(
                models.StreamingBuffer.topic_id == topic.id,
                models.StreamingBuffer.processed == False
            ).count()
            
            streaming_stats.append({
                "topic": topic.name,
                "pending_messages": pending
            })
        
        health["streaming"] = {
            "active_topics": len(topics),
            "topics": streaming_stats
        }
    except Exception as e:
        health["streaming"] = {"error": str(e)}
    
    return health

