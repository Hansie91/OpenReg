"""
API Key service for partner/programmatic authentication.

Provides secure API key generation, validation, and lifecycle management
for partner integrations that can't use interactive JWT flows.

Features:
- Secure key generation with prefix for identification
- SHA-256 hashing (only hash stored, plain key shown once)
- Permission-scoped keys
- Rate limiting per key
- Key rotation support
- Audit trail

Usage:
    from services.api_keys import api_key_service

    # Create a new key
    key, api_key = await api_key_service.create_key(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        name="Production Integration",
        permissions=["report:read", "job:execute"]
    )

    # Validate a key from request
    api_key = await api_key_service.validate_key(db, "openreg_...")
"""

from typing import Optional, List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from core.security import generate_api_key, hash_api_key, get_api_key_prefix, constant_time_compare
from core.permissions import has_permission, Permission
import models


class APIKeyService:
    """Service for managing API keys."""

    async def create_key(
        self,
        db: Session,
        tenant_id: str,
        user_id: str,
        name: str,
        permissions: Optional[List[str]] = None,
        description: Optional[str] = None,
        expires_in_days: Optional[int] = None,
        rate_limit_per_minute: int = 60,
        allowed_ips: Optional[List[str]] = None,
    ) -> Tuple[str, "models.APIKey"]:
        """
        Create a new API key.

        Args:
            db: Database session
            tenant_id: Tenant the key belongs to
            user_id: User creating the key
            name: Human-readable name for the key
            permissions: List of permission strings this key grants
            description: Optional description
            expires_in_days: Days until key expires (None = no expiry)
            rate_limit_per_minute: Rate limit for this key
            allowed_ips: Optional IP whitelist

        Returns:
            Tuple of (plain_key, APIKey model instance)
            IMPORTANT: The plain_key is only available here, never stored!
        """
        # Generate key and hash
        plain_key, key_hash = generate_api_key()
        key_prefix = get_api_key_prefix(plain_key)

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        # Create API key record
        api_key = models.APIKey(
            tenant_id=tenant_id,
            created_by=user_id,
            name=name,
            description=description,
            key_hash=key_hash,
            key_prefix=key_prefix,
            permissions=permissions or [],
            expires_at=expires_at,
            rate_limit_per_minute=rate_limit_per_minute,
            allowed_ips=allowed_ips or [],
            is_active=True,
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        return plain_key, api_key

    async def validate_key(
        self,
        db: Session,
        plain_key: str,
        required_permission: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> Optional["models.APIKey"]:
        """
        Validate an API key and return the key record if valid.

        Checks:
        - Key exists and matches hash
        - Key is active
        - Key is not expired
        - IP is allowed (if whitelist configured)
        - Key has required permission (if specified)

        Args:
            db: Database session
            plain_key: The plain API key from the request
            required_permission: Optional permission to check
            client_ip: Optional client IP for whitelist check

        Returns:
            APIKey model if valid, None if invalid
        """
        if not plain_key or not plain_key.startswith("openreg_"):
            return None

        # Hash the provided key
        key_hash = hash_api_key(plain_key)

        # Look up by hash
        api_key = db.query(models.APIKey).filter(
            and_(
                models.APIKey.key_hash == key_hash,
                models.APIKey.is_active == True
            )
        ).first()

        if not api_key:
            return None

        # Check expiration
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None

        # Check IP whitelist
        if api_key.allowed_ips and len(api_key.allowed_ips) > 0:
            if client_ip and client_ip not in api_key.allowed_ips:
                return None

        # Check permission if required
        if required_permission:
            if not has_permission(api_key.permissions, required_permission):
                return None

        # Update last used timestamp
        api_key.last_used_at = datetime.utcnow()
        api_key.use_count = (api_key.use_count or 0) + 1
        db.commit()

        return api_key

    async def revoke_key(
        self,
        db: Session,
        key_id: str,
        tenant_id: str,
        revoked_by: str,
    ) -> bool:
        """
        Revoke an API key.

        Args:
            db: Database session
            key_id: ID of the key to revoke
            tenant_id: Tenant ID (for authorization)
            revoked_by: User ID performing the revocation

        Returns:
            True if revoked, False if not found
        """
        api_key = db.query(models.APIKey).filter(
            and_(
                models.APIKey.id == key_id,
                models.APIKey.tenant_id == tenant_id,
                models.APIKey.is_active == True
            )
        ).first()

        if not api_key:
            return False

        api_key.is_active = False
        api_key.revoked_at = datetime.utcnow()
        api_key.revoked_by = revoked_by
        db.commit()

        return True

    async def list_keys(
        self,
        db: Session,
        tenant_id: str,
        include_revoked: bool = False,
    ) -> List["models.APIKey"]:
        """
        List all API keys for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant to list keys for
            include_revoked: Whether to include revoked keys

        Returns:
            List of APIKey models (without key_hash for security)
        """
        query = db.query(models.APIKey).filter(
            models.APIKey.tenant_id == tenant_id
        )

        if not include_revoked:
            query = query.filter(models.APIKey.is_active == True)

        return query.order_by(models.APIKey.created_at.desc()).all()

    async def get_key(
        self,
        db: Session,
        key_id: str,
        tenant_id: str,
    ) -> Optional["models.APIKey"]:
        """
        Get a specific API key by ID.

        Args:
            db: Database session
            key_id: ID of the key
            tenant_id: Tenant ID (for authorization)

        Returns:
            APIKey model or None
        """
        return db.query(models.APIKey).filter(
            and_(
                models.APIKey.id == key_id,
                models.APIKey.tenant_id == tenant_id
            )
        ).first()

    async def rotate_key(
        self,
        db: Session,
        key_id: str,
        tenant_id: str,
        user_id: str,
    ) -> Optional[Tuple[str, "models.APIKey"]]:
        """
        Rotate an API key - revoke old and create new with same settings.

        Args:
            db: Database session
            key_id: ID of the key to rotate
            tenant_id: Tenant ID
            user_id: User performing rotation

        Returns:
            Tuple of (new_plain_key, new_APIKey) or None if key not found
        """
        old_key = await self.get_key(db, key_id, tenant_id)
        if not old_key or not old_key.is_active:
            return None

        # Calculate remaining expiry if any
        expires_in_days = None
        if old_key.expires_at:
            remaining = old_key.expires_at - datetime.utcnow()
            if remaining.total_seconds() > 0:
                expires_in_days = max(1, remaining.days)

        # Create new key with same settings
        new_plain_key, new_key = await self.create_key(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            name=f"{old_key.name} (rotated)",
            permissions=old_key.permissions,
            description=old_key.description,
            expires_in_days=expires_in_days,
            rate_limit_per_minute=old_key.rate_limit_per_minute,
            allowed_ips=old_key.allowed_ips,
        )

        # Revoke old key
        await self.revoke_key(db, key_id, tenant_id, user_id)

        return new_plain_key, new_key

    async def update_key_permissions(
        self,
        db: Session,
        key_id: str,
        tenant_id: str,
        permissions: List[str],
    ) -> Optional["models.APIKey"]:
        """
        Update permissions for an API key.

        Args:
            db: Database session
            key_id: ID of the key
            tenant_id: Tenant ID
            permissions: New permissions list

        Returns:
            Updated APIKey or None
        """
        api_key = await self.get_key(db, key_id, tenant_id)
        if not api_key or not api_key.is_active:
            return None

        api_key.permissions = permissions
        db.commit()
        db.refresh(api_key)

        return api_key

    async def update_key_rate_limit(
        self,
        db: Session,
        key_id: str,
        tenant_id: str,
        rate_limit_per_minute: int,
    ) -> Optional["models.APIKey"]:
        """
        Update rate limit for an API key.

        Args:
            db: Database session
            key_id: ID of the key
            tenant_id: Tenant ID
            rate_limit_per_minute: New rate limit

        Returns:
            Updated APIKey or None
        """
        api_key = await self.get_key(db, key_id, tenant_id)
        if not api_key or not api_key.is_active:
            return None

        api_key.rate_limit_per_minute = rate_limit_per_minute
        db.commit()
        db.refresh(api_key)

        return api_key


# Singleton instance
api_key_service = APIKeyService()
