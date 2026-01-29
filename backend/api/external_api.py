"""
External API Management Endpoints

Endpoints for managing external regulatory API connections,
triggering syncs, viewing history, and resolving conflicts.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from models import (
    ExternalAPIConfig, ExternalAPISyncLog, ExternalSyncStatus,
    ExternalAPIAuthType, SyncModeType, SyncTriggerType,
    Report, ValidationRule, Schedule, MappingSet
)
from database import get_db
from services.auth import get_current_user, encrypt_credentials, log_audit
# Note: require_permissions is a decorator, not a dependency
# For now, we use get_current_user directly for API access
from services.external_api import ExternalRegulatoryAPIClient, ExternalAPISyncService, SchemaMapper
from tasks.external_sync_tasks import sync_external_api_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/external-api", tags=["External API"])


# === Pydantic Schemas ===

class ExternalAPIConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    api_base_url: str = Field(..., min_length=1, max_length=1000)
    api_version: Optional[str] = None
    auth_type: str = "api_key"
    credentials: dict = Field(default_factory=dict)  # Will be encrypted
    rate_limit_per_minute: int = 60
    retry_config: Optional[dict] = None
    cache_ttl_seconds: int = 3600
    sync_schedule: Optional[str] = None  # Cron expression
    auto_sync_enabled: bool = True
    schema_mapping: Optional[dict] = None


class ExternalAPIConfigUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    api_base_url: Optional[str] = None
    api_version: Optional[str] = None
    auth_type: Optional[str] = None
    credentials: Optional[dict] = None  # Will be encrypted if provided
    rate_limit_per_minute: Optional[int] = None
    retry_config: Optional[dict] = None
    cache_ttl_seconds: Optional[int] = None
    sync_schedule: Optional[str] = None
    auto_sync_enabled: Optional[bool] = None
    schema_mapping: Optional[dict] = None
    is_active: Optional[bool] = None


class ExternalAPIConfigResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    api_base_url: str
    api_version: Optional[str]
    auth_type: str
    rate_limit_per_minute: int
    cache_ttl_seconds: int
    sync_schedule: Optional[str]
    auto_sync_enabled: bool
    schema_mapping: dict
    is_active: bool
    last_sync_at: Optional[datetime]
    last_sync_status: Optional[str]
    last_sync_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SyncTriggerRequest(BaseModel):
    mode: str = "differential"  # "full" or "differential"


class SyncStatusResponse(BaseModel):
    total_reports: int
    synced_reports: int
    modified_reports: int
    conflict_reports: int
    total_validations: int
    synced_validations: int
    modified_validations: int
    conflict_validations: int
    total_reference_data: int
    synced_reference_data: int
    modified_reference_data: int
    conflict_reference_data: int
    total_schedules: int
    synced_schedules: int
    modified_schedules: int
    conflict_schedules: int


class SyncHistoryResponse(BaseModel):
    id: str
    sync_type: str
    triggered_by: str
    started_at: datetime
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    status: str
    items_fetched: int
    reports_created: int
    reports_updated: int
    validations_created: int
    validations_updated: int
    reference_data_created: int
    reference_data_updated: int
    schedules_created: int
    schedules_updated: int
    conflicts_detected: int
    error_message: Optional[str]

    class Config:
        from_attributes = True


class ConflictResponse(BaseModel):
    entity_type: str
    id: str
    external_id: str
    name: str
    upstream_version: Optional[str]
    forked_at: Optional[str]


class ConflictResolutionRequest(BaseModel):
    resolution: str  # "keep_local" or "take_upstream"


# === API Config Endpoints ===

@router.get("/configs", response_model=List[ExternalAPIConfigResponse])
async def list_api_configs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all external API configurations for the current tenant"""
    configs = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).order_by(ExternalAPIConfig.created_at.desc()).all()

    return [ExternalAPIConfigResponse(
        id=str(c.id),
        tenant_id=str(c.tenant_id),
        name=c.name,
        description=c.description,
        api_base_url=c.api_base_url,
        api_version=c.api_version,
        auth_type=c.auth_type.value if c.auth_type else "api_key",
        rate_limit_per_minute=c.rate_limit_per_minute,
        cache_ttl_seconds=c.cache_ttl_seconds,
        sync_schedule=c.sync_schedule,
        auto_sync_enabled=c.auto_sync_enabled,
        schema_mapping=c.schema_mapping or {},
        is_active=c.is_active,
        last_sync_at=c.last_sync_at,
        last_sync_status=c.last_sync_status,
        last_sync_message=c.last_sync_message,
        created_at=c.created_at,
        updated_at=c.updated_at
    ) for c in configs]


@router.post("/configs", response_model=ExternalAPIConfigResponse, status_code=201)
async def create_api_config(
    config_data: ExternalAPIConfigCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new external API configuration"""
    # Encrypt credentials
    encrypted_creds = None
    if config_data.credentials:
        encrypted_creds = encrypt_credentials(json.dumps(config_data.credentials))

    new_config = ExternalAPIConfig(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        name=config_data.name,
        description=config_data.description,
        api_base_url=config_data.api_base_url,
        api_version=config_data.api_version,
        auth_type=ExternalAPIAuthType(config_data.auth_type),
        encrypted_credentials=encrypted_creds,
        rate_limit_per_minute=config_data.rate_limit_per_minute,
        retry_config=config_data.retry_config or {"max_retries": 3, "backoff": "exponential", "base_delay": 2, "max_delay": 60},
        cache_ttl_seconds=config_data.cache_ttl_seconds,
        sync_schedule=config_data.sync_schedule,
        auto_sync_enabled=config_data.auto_sync_enabled,
        schema_mapping=config_data.schema_mapping or {},
        is_active=True
    )

    db.add(new_config)
    db.commit()
    db.refresh(new_config)

    log_audit(db, current_user, models.AuditAction.CREATE, "ExternalAPIConfig", str(new_config.id),
              changes={"name": config_data.name, "base_url": config_data.api_base_url})

    logger.info(f"Created external API config: {new_config.name} ({new_config.id})")

    return ExternalAPIConfigResponse(
        id=str(new_config.id),
        tenant_id=str(new_config.tenant_id),
        name=new_config.name,
        description=new_config.description,
        api_base_url=new_config.api_base_url,
        api_version=new_config.api_version,
        auth_type=new_config.auth_type.value if new_config.auth_type else "api_key",
        rate_limit_per_minute=new_config.rate_limit_per_minute,
        cache_ttl_seconds=new_config.cache_ttl_seconds,
        sync_schedule=new_config.sync_schedule,
        auto_sync_enabled=new_config.auto_sync_enabled,
        schema_mapping=new_config.schema_mapping or {},
        is_active=new_config.is_active,
        last_sync_at=new_config.last_sync_at,
        last_sync_status=new_config.last_sync_status,
        last_sync_message=new_config.last_sync_message,
        created_at=new_config.created_at,
        updated_at=new_config.updated_at
    )


@router.get("/configs/{config_id}", response_model=ExternalAPIConfigResponse)
async def get_api_config(
    config_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get details of a specific API configuration"""
    config = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.id == config_id,
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="API configuration not found")

    return ExternalAPIConfigResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id),
        name=config.name,
        description=config.description,
        api_base_url=config.api_base_url,
        api_version=config.api_version,
        auth_type=config.auth_type.value if config.auth_type else "api_key",
        rate_limit_per_minute=config.rate_limit_per_minute,
        cache_ttl_seconds=config.cache_ttl_seconds,
        sync_schedule=config.sync_schedule,
        auto_sync_enabled=config.auto_sync_enabled,
        schema_mapping=config.schema_mapping or {},
        is_active=config.is_active,
        last_sync_at=config.last_sync_at,
        last_sync_status=config.last_sync_status,
        last_sync_message=config.last_sync_message,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.put("/configs/{config_id}", response_model=ExternalAPIConfigResponse)
async def update_api_config(
    config_id: str,
    config_data: ExternalAPIConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update an API configuration"""
    config = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.id == config_id,
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="API configuration not found")

    # Update fields
    if config_data.name is not None:
        config.name = config_data.name
    if config_data.description is not None:
        config.description = config_data.description
    if config_data.api_base_url is not None:
        config.api_base_url = config_data.api_base_url
    if config_data.api_version is not None:
        config.api_version = config_data.api_version
    if config_data.auth_type is not None:
        config.auth_type = ExternalAPIAuthType(config_data.auth_type)
    if config_data.credentials is not None:
        config.encrypted_credentials = encrypt_credentials(json.dumps(config_data.credentials))
    if config_data.rate_limit_per_minute is not None:
        config.rate_limit_per_minute = config_data.rate_limit_per_minute
    if config_data.retry_config is not None:
        config.retry_config = config_data.retry_config
    if config_data.cache_ttl_seconds is not None:
        config.cache_ttl_seconds = config_data.cache_ttl_seconds
    if config_data.sync_schedule is not None:
        config.sync_schedule = config_data.sync_schedule
    if config_data.auto_sync_enabled is not None:
        config.auto_sync_enabled = config_data.auto_sync_enabled
    if config_data.schema_mapping is not None:
        config.schema_mapping = config_data.schema_mapping
    if config_data.is_active is not None:
        config.is_active = config_data.is_active

    db.commit()
    db.refresh(config)

    # Exclude credentials from logged changes
    update_data = config_data.model_dump(exclude_unset=True)
    safe_changes = {k: v for k, v in update_data.items() if v is not None and k != "credentials"}
    log_audit(db, current_user, models.AuditAction.UPDATE, "ExternalAPIConfig", str(config.id), changes=safe_changes)

    return ExternalAPIConfigResponse(
        id=str(config.id),
        tenant_id=str(config.tenant_id),
        name=config.name,
        description=config.description,
        api_base_url=config.api_base_url,
        api_version=config.api_version,
        auth_type=config.auth_type.value if config.auth_type else "api_key",
        rate_limit_per_minute=config.rate_limit_per_minute,
        cache_ttl_seconds=config.cache_ttl_seconds,
        sync_schedule=config.sync_schedule,
        auto_sync_enabled=config.auto_sync_enabled,
        schema_mapping=config.schema_mapping or {},
        is_active=config.is_active,
        last_sync_at=config.last_sync_at,
        last_sync_status=config.last_sync_status,
        last_sync_message=config.last_sync_message,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.delete("/configs/{config_id}", status_code=204)
async def delete_api_config(
    config_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete an API configuration"""
    config = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.id == config_id,
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="API configuration not found")

    log_audit(db, current_user, models.AuditAction.DELETE, "ExternalAPIConfig", config_id)

    db.delete(config)
    db.commit()

    logger.info(f"Deleted external API config: {config_id}")


@router.post("/configs/{config_id}/test")
async def test_api_connection(
    config_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Test connection to external API"""
    config = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.id == config_id,
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="API configuration not found")

    # Create client and test connection
    client = ExternalRegulatoryAPIClient(
        api_base_url=config.api_base_url,
        auth_type=config.auth_type,
        encrypted_credentials=config.encrypted_credentials,
        api_version=config.api_version,
        rate_limit_per_minute=config.rate_limit_per_minute,
        retry_config=config.retry_config or {},
        cache_ttl_seconds=config.cache_ttl_seconds,
        schema_mapping=config.schema_mapping or {}
    )

    # Run async test
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(client.test_connection())
    finally:
        loop.close()

    return result


# === Sync Endpoints ===

@router.post("/configs/{config_id}/sync")
async def trigger_sync(
    config_id: str,
    request: SyncTriggerRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Manually trigger a sync operation"""
    config = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.id == config_id,
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="API configuration not found")

    if not config.is_active:
        raise HTTPException(status_code=400, detail="API configuration is inactive")

    # Queue sync task
    task = sync_external_api_task.delay(
        api_config_id=str(config.id),
        mode=request.mode,
        triggered_by="manual",
        trigger_user_id=str(current_user.id)
    )

    log_audit(db, current_user, models.AuditAction.EXECUTE, "ExternalAPIConfig", str(config.id),
              changes={"action": "manual_sync", "sync_type": request.mode})

    logger.info(f"Triggered sync for {config.name}: task_id={task.id}")

    return {
        "message": f"Sync triggered for {config.name}",
        "task_id": str(task.id),
        "mode": request.mode
    }


@router.get("/configs/{config_id}/sync-history", response_model=List[SyncHistoryResponse])
async def get_sync_history(
    config_id: str,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get sync history for an API configuration"""
    config = db.query(ExternalAPIConfig).filter(
        ExternalAPIConfig.id == config_id,
        ExternalAPIConfig.tenant_id == current_user.tenant_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="API configuration not found")

    logs = db.query(ExternalAPISyncLog).filter(
        ExternalAPISyncLog.api_config_id == config.id
    ).order_by(ExternalAPISyncLog.started_at.desc()).offset(offset).limit(limit).all()

    return [SyncHistoryResponse(
        id=str(log.id),
        sync_type=log.sync_type.value if log.sync_type else "differential",
        triggered_by=log.triggered_by.value if log.triggered_by else "manual",
        started_at=log.started_at,
        completed_at=log.completed_at,
        duration_ms=log.duration_ms,
        status=log.status,
        items_fetched=log.items_fetched,
        reports_created=log.reports_created,
        reports_updated=log.reports_updated,
        validations_created=log.validations_created,
        validations_updated=log.validations_updated,
        reference_data_created=log.reference_data_created,
        reference_data_updated=log.reference_data_updated,
        schedules_created=log.schedules_created,
        schedules_updated=log.schedules_updated,
        conflicts_detected=log.conflicts_detected,
        error_message=log.error_message
    ) for log in logs]


@router.get("/sync-status", response_model=SyncStatusResponse)
async def get_sync_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get overall sync status across all entities"""
    tenant_id = current_user.tenant_id

    # Count reports by sync status
    total_reports = db.query(Report).filter(Report.tenant_id == tenant_id).count()
    synced_reports = db.query(Report).filter(
        Report.tenant_id == tenant_id,
        Report.sync_status == ExternalSyncStatus.SYNCED
    ).count()
    modified_reports = db.query(Report).filter(
        Report.tenant_id == tenant_id,
        Report.sync_status == ExternalSyncStatus.LOCAL_MODIFIED
    ).count()
    conflict_reports = db.query(Report).filter(
        Report.tenant_id == tenant_id,
        Report.sync_status == ExternalSyncStatus.CONFLICT
    ).count()

    # Count validations by sync status
    total_validations = db.query(ValidationRule).filter(ValidationRule.tenant_id == tenant_id).count()
    synced_validations = db.query(ValidationRule).filter(
        ValidationRule.tenant_id == tenant_id,
        ValidationRule.sync_status == ExternalSyncStatus.SYNCED
    ).count()
    modified_validations = db.query(ValidationRule).filter(
        ValidationRule.tenant_id == tenant_id,
        ValidationRule.sync_status == ExternalSyncStatus.LOCAL_MODIFIED
    ).count()
    conflict_validations = db.query(ValidationRule).filter(
        ValidationRule.tenant_id == tenant_id,
        ValidationRule.sync_status == ExternalSyncStatus.CONFLICT
    ).count()

    # Count reference data by sync status
    total_reference_data = db.query(MappingSet).filter(MappingSet.tenant_id == tenant_id).count()
    synced_reference_data = db.query(MappingSet).filter(
        MappingSet.tenant_id == tenant_id,
        MappingSet.sync_status == ExternalSyncStatus.SYNCED
    ).count()
    modified_reference_data = db.query(MappingSet).filter(
        MappingSet.tenant_id == tenant_id,
        MappingSet.sync_status == ExternalSyncStatus.LOCAL_MODIFIED
    ).count()
    conflict_reference_data = db.query(MappingSet).filter(
        MappingSet.tenant_id == tenant_id,
        MappingSet.sync_status == ExternalSyncStatus.CONFLICT
    ).count()

    # Count schedules by sync status
    total_schedules = db.query(Schedule).filter(Schedule.tenant_id == tenant_id).count()
    synced_schedules = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.sync_status == ExternalSyncStatus.SYNCED
    ).count()
    modified_schedules = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.sync_status == ExternalSyncStatus.LOCAL_MODIFIED
    ).count()
    conflict_schedules = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.sync_status == ExternalSyncStatus.CONFLICT
    ).count()

    return SyncStatusResponse(
        total_reports=total_reports,
        synced_reports=synced_reports,
        modified_reports=modified_reports,
        conflict_reports=conflict_reports,
        total_validations=total_validations,
        synced_validations=synced_validations,
        modified_validations=modified_validations,
        conflict_validations=conflict_validations,
        total_reference_data=total_reference_data,
        synced_reference_data=synced_reference_data,
        modified_reference_data=modified_reference_data,
        conflict_reference_data=conflict_reference_data,
        total_schedules=total_schedules,
        synced_schedules=synced_schedules,
        modified_schedules=modified_schedules,
        conflict_schedules=conflict_schedules
    )


# === Conflict Endpoints ===

@router.get("/conflicts", response_model=List[ConflictResponse])
async def list_conflicts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all items with sync conflicts"""
    tenant_id = current_user.tenant_id
    conflicts = []

    # Reports
    report_conflicts = db.query(Report).filter(
        Report.tenant_id == tenant_id,
        Report.sync_status == ExternalSyncStatus.CONFLICT
    ).all()
    for r in report_conflicts:
        conflicts.append(ConflictResponse(
            entity_type="report",
            id=str(r.id),
            external_id=r.external_id or "",
            name=r.name,
            upstream_version=r.upstream_version,
            forked_at=r.forked_at.isoformat() if r.forked_at else None
        ))

    # Validation rules
    validation_conflicts = db.query(ValidationRule).filter(
        ValidationRule.tenant_id == tenant_id,
        ValidationRule.sync_status == ExternalSyncStatus.CONFLICT
    ).all()
    for v in validation_conflicts:
        conflicts.append(ConflictResponse(
            entity_type="validation_rule",
            id=str(v.id),
            external_id=v.external_id or "",
            name=v.name,
            upstream_version=v.upstream_version,
            forked_at=v.forked_at.isoformat() if v.forked_at else None
        ))

    # Schedules
    schedule_conflicts = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.sync_status == ExternalSyncStatus.CONFLICT
    ).all()
    for s in schedule_conflicts:
        conflicts.append(ConflictResponse(
            entity_type="schedule",
            id=str(s.id),
            external_id=s.external_id or "",
            name=s.name,
            upstream_version=s.upstream_version,
            forked_at=s.forked_at.isoformat() if s.forked_at else None
        ))

    # Mapping sets
    mapping_conflicts = db.query(MappingSet).filter(
        MappingSet.tenant_id == tenant_id,
        MappingSet.sync_status == ExternalSyncStatus.CONFLICT
    ).all()
    for m in mapping_conflicts:
        conflicts.append(ConflictResponse(
            entity_type="mapping_set",
            id=str(m.id),
            external_id=m.external_id or "",
            name=m.name,
            upstream_version=m.upstream_version,
            forked_at=m.forked_at.isoformat() if m.forked_at else None
        ))

    return conflicts


@router.post("/conflicts/{entity_type}/{entity_id}/resolve")
async def resolve_conflict(
    entity_type: str,
    entity_id: str,
    request: ConflictResolutionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Resolve a sync conflict"""
    tenant_id = current_user.tenant_id

    # Get entity
    if entity_type == "report":
        entity = db.query(Report).filter(
            Report.id == entity_id,
            Report.tenant_id == tenant_id
        ).first()
    elif entity_type == "validation_rule":
        entity = db.query(ValidationRule).filter(
            ValidationRule.id == entity_id,
            ValidationRule.tenant_id == tenant_id
        ).first()
    elif entity_type == "schedule":
        entity = db.query(Schedule).filter(
            Schedule.id == entity_id,
            Schedule.tenant_id == tenant_id
        ).first()
    elif entity_type == "mapping_set":
        entity = db.query(MappingSet).filter(
            MappingSet.id == entity_id,
            MappingSet.tenant_id == tenant_id
        ).first()
    else:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    if not entity:
        raise HTTPException(status_code=404, detail=f"{entity_type} not found")

    if entity.sync_status != ExternalSyncStatus.CONFLICT:
        raise HTTPException(status_code=400, detail="Entity is not in conflict status")

    # Apply resolution
    if request.resolution == "keep_local":
        entity.sync_status = ExternalSyncStatus.LOCAL_MODIFIED
        entity.forked_at = entity.forked_at or datetime.utcnow()
        entity.forked_from_version = entity.upstream_version
        message = "Kept local changes, marked as modified"
    elif request.resolution == "take_upstream":
        # Mark for re-sync
        entity.sync_status = ExternalSyncStatus.UPSTREAM_CHANGED
        entity.local_hash = None  # Force update on next sync
        message = "Will take upstream version on next sync"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid resolution: {request.resolution}")

    db.commit()

    logger.info(f"Resolved conflict for {entity_type}/{entity_id}: {request.resolution}")

    return {
        "message": message,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "resolution": request.resolution,
        "new_status": entity.sync_status.value
    }


# === Import Endpoint ===

@router.post("/import")
async def import_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Import regulatory data from a JSON file"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a JSON file")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    # Use schema mapper
    mapper = SchemaMapper()
    mapped = mapper.map_all(
        reports=data.get('reports', []),
        validations=data.get('validation_rules', []),
        reference_data=data.get('reference_data', []),
        schedules=data.get('schedules', [])
    )

    result = {
        "reports_found": len(mapped['reports']),
        "validations_found": len(mapped['validations']),
        "reference_data_found": len(mapped['reference_data']),
        "schedules_found": len(mapped['schedules']),
        "message": "File parsed successfully. Use sync endpoint to import data."
    }

    logger.info(f"Parsed import file: {file.filename} - {result}")

    return result
