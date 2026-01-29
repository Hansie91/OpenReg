"""
API Key management endpoints.

Provides endpoints for creating, listing, and revoking API keys
for partner/programmatic integrations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from database import get_db
from services.auth import get_current_user, log_audit
from services.api_keys import api_key_service
from core.permissions import Permission, PermissionChecker
import models

router = APIRouter()


# === Pydantic Schemas ===

class CreateAPIKeyRequest(BaseModel):
    """Request to create a new API key."""
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name")
    description: Optional[str] = Field(None, max_length=1000)
    permissions: List[str] = Field(default_factory=list, description="Permission strings")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Days until expiry")
    rate_limit_per_minute: int = Field(60, ge=1, le=10000)
    allowed_ips: List[str] = Field(default_factory=list, description="IP whitelist")


class CreateAPIKeyResponse(BaseModel):
    """Response after creating an API key - includes plain key (shown only once!)."""
    id: str
    name: str
    key: str = Field(..., description="The API key - SAVE THIS, it will not be shown again!")
    key_prefix: str
    permissions: List[str]
    expires_at: Optional[datetime]
    created_at: datetime


class APIKeyResponse(BaseModel):
    """API key details (without the actual key)."""
    id: str
    name: str
    description: Optional[str]
    key_prefix: str
    permissions: List[str]
    allowed_ips: List[str]
    rate_limit_per_minute: int
    is_active: bool
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    use_count: int
    created_at: datetime
    revoked_at: Optional[datetime]

    class Config:
        from_attributes = True


class UpdateAPIKeyRequest(BaseModel):
    """Request to update API key settings."""
    permissions: Optional[List[str]] = None
    rate_limit_per_minute: Optional[int] = Field(None, ge=1, le=10000)
    allowed_ips: Optional[List[str]] = None


class RotateKeyResponse(BaseModel):
    """Response after rotating an API key."""
    id: str
    name: str
    key: str = Field(..., description="The new API key - SAVE THIS!")
    key_prefix: str
    message: str = "Key rotated successfully. The old key has been revoked."


# === Endpoints ===

@router.post("", response_model=CreateAPIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: CreateAPIKeyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(Permission.API_KEY_CREATE)),
):
    """
    Create a new API key.

    The plain key is returned ONLY in this response - it cannot be retrieved later.
    Store it securely!

    Requires: apikey:create permission
    """
    plain_key, api_key = await api_key_service.create_key(
        db=db,
        tenant_id=str(current_user.tenant_id),
        user_id=str(current_user.id),
        name=request.name,
        description=request.description,
        permissions=request.permissions,
        expires_in_days=request.expires_in_days,
        rate_limit_per_minute=request.rate_limit_per_minute,
        allowed_ips=request.allowed_ips,
    )

    log_audit(db, current_user, models.AuditAction.CREATE, "APIKey", str(api_key.id),
              changes={"name": request.name, "scopes": request.permissions})

    return CreateAPIKeyResponse(
        id=str(api_key.id),
        name=api_key.name,
        key=plain_key,
        key_prefix=api_key.key_prefix,
        permissions=api_key.permissions,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
    )


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    include_revoked: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(Permission.API_KEY_READ)),
):
    """
    List all API keys for the tenant.

    Does not include the actual key values (only prefix for identification).

    Requires: apikey:read permission
    """
    keys = await api_key_service.list_keys(
        db=db,
        tenant_id=str(current_user.tenant_id),
        include_revoked=include_revoked,
    )

    return [
        APIKeyResponse(
            id=str(key.id),
            name=key.name,
            description=key.description,
            key_prefix=key.key_prefix,
            permissions=key.permissions or [],
            allowed_ips=key.allowed_ips or [],
            rate_limit_per_minute=key.rate_limit_per_minute,
            is_active=key.is_active,
            expires_at=key.expires_at,
            last_used_at=key.last_used_at,
            use_count=key.use_count or 0,
            created_at=key.created_at,
            revoked_at=key.revoked_at,
        )
        for key in keys
    ]


@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(Permission.API_KEY_READ)),
):
    """
    Get details of a specific API key.

    Requires: apikey:read permission
    """
    api_key = await api_key_service.get_key(
        db=db,
        key_id=key_id,
        tenant_id=str(current_user.tenant_id),
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    return APIKeyResponse(
        id=str(api_key.id),
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        permissions=api_key.permissions or [],
        allowed_ips=api_key.allowed_ips or [],
        rate_limit_per_minute=api_key.rate_limit_per_minute,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        use_count=api_key.use_count or 0,
        created_at=api_key.created_at,
        revoked_at=api_key.revoked_at,
    )


@router.patch("/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: str,
    request: UpdateAPIKeyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(Permission.API_KEY_CREATE)),
):
    """
    Update API key settings (permissions, rate limit, IP whitelist).

    Note: To change the key itself, use the rotate endpoint.

    Requires: apikey:create permission
    """
    api_key = await api_key_service.get_key(
        db=db,
        key_id=key_id,
        tenant_id=str(current_user.tenant_id),
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )

    if not api_key.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a revoked API key"
        )

    # Update fields
    if request.permissions is not None:
        api_key.permissions = request.permissions
    if request.rate_limit_per_minute is not None:
        api_key.rate_limit_per_minute = request.rate_limit_per_minute
    if request.allowed_ips is not None:
        api_key.allowed_ips = request.allowed_ips

    db.commit()
    db.refresh(api_key)

    update_data = request.model_dump(exclude_unset=True)
    log_audit(db, current_user, models.AuditAction.UPDATE, "APIKey", str(api_key.id),
              changes={k: v for k, v in update_data.items() if v is not None})

    return APIKeyResponse(
        id=str(api_key.id),
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        permissions=api_key.permissions or [],
        allowed_ips=api_key.allowed_ips or [],
        rate_limit_per_minute=api_key.rate_limit_per_minute,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        use_count=api_key.use_count or 0,
        created_at=api_key.created_at,
        revoked_at=api_key.revoked_at,
    )


@router.post("/{key_id}/rotate", response_model=RotateKeyResponse)
async def rotate_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(Permission.API_KEY_CREATE)),
):
    """
    Rotate an API key - creates new key with same settings, revokes old key.

    Use this for key rotation policies or if a key may be compromised.

    Requires: apikey:create permission
    """
    result = await api_key_service.rotate_key(
        db=db,
        key_id=key_id,
        tenant_id=str(current_user.tenant_id),
        user_id=str(current_user.id),
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or already revoked"
        )

    plain_key, new_api_key = result

    log_audit(db, current_user, models.AuditAction.UPDATE, "APIKey", str(new_api_key.id),
              changes={"action": "rotate"})

    return RotateKeyResponse(
        id=str(new_api_key.id),
        name=new_api_key.name,
        key=plain_key,
        key_prefix=new_api_key.key_prefix,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    _: bool = Depends(PermissionChecker(Permission.API_KEY_REVOKE)),
):
    """
    Revoke an API key immediately.

    The key will no longer work for authentication.

    Requires: apikey:revoke permission
    """
    success = await api_key_service.revoke_key(
        db=db,
        key_id=key_id,
        tenant_id=str(current_user.tenant_id),
        revoked_by=str(current_user.id),
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or already revoked"
        )

    log_audit(db, current_user, models.AuditAction.UPDATE, "APIKey", key_id,
              changes={"is_active": False, "action": "revoke"})

    return None
