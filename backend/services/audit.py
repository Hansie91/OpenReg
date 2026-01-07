"""
Comprehensive audit event system.

Provides centralized audit logging for security, compliance, and debugging.
Supports multiple event types and async event emission.
"""

import enum
from datetime import datetime
from typing import Any, Dict, Optional, Union
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import Request

from core.logging import get_logger, LogContext
import models

logger = get_logger(__name__)


class AuditEventType(str, enum.Enum):
    """Types of audit events."""
    # Authentication events
    LOGIN_SUCCESS = "auth.login_success"
    LOGIN_FAILED = "auth.login_failed"
    LOGOUT = "auth.logout"
    LOGOUT_ALL = "auth.logout_all"
    TOKEN_REFRESH = "auth.token_refresh"
    TOKEN_REVOKED = "auth.token_revoked"
    PASSWORD_CHANGED = "auth.password_changed"
    PASSWORD_RESET_REQUESTED = "auth.password_reset_requested"

    # API Key events
    API_KEY_CREATED = "api_key.created"
    API_KEY_USED = "api_key.used"
    API_KEY_REVOKED = "api_key.revoked"
    API_KEY_ROTATED = "api_key.rotated"

    # Resource events
    RESOURCE_CREATED = "resource.created"
    RESOURCE_UPDATED = "resource.updated"
    RESOURCE_DELETED = "resource.deleted"
    RESOURCE_ACCESSED = "resource.accessed"

    # Execution events
    JOB_STARTED = "job.started"
    JOB_COMPLETED = "job.completed"
    JOB_FAILED = "job.failed"
    JOB_CANCELLED = "job.cancelled"

    # Security events
    PERMISSION_DENIED = "security.permission_denied"
    RATE_LIMIT_EXCEEDED = "security.rate_limit_exceeded"
    INVALID_TOKEN = "security.invalid_token"
    SUSPICIOUS_ACTIVITY = "security.suspicious_activity"
    IP_BLOCKED = "security.ip_blocked"

    # Configuration events
    CONFIG_CHANGED = "config.changed"
    ENVIRONMENT_SWITCHED = "config.environment_switched"
    WEBHOOK_CONFIGURED = "config.webhook_configured"

    # Data events
    DATA_EXPORTED = "data.exported"
    DATA_IMPORTED = "data.imported"
    ARTIFACT_DOWNLOADED = "data.artifact_downloaded"
    ARTIFACT_DELIVERED = "data.artifact_delivered"


class AuditSeverity(str, enum.Enum):
    """Severity levels for audit events."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AuditService:
    """Service for logging audit events."""

    @staticmethod
    def log_event(
        db: Session,
        event_type: AuditEventType,
        user_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        action: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: AuditSeverity = AuditSeverity.INFO,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> models.AuditLog:
        """
        Log an audit event to the database.

        Args:
            db: Database session
            event_type: Type of audit event
            user_id: ID of user who triggered the event
            tenant_id: ID of tenant context
            entity_type: Type of entity affected (e.g., "Report", "User")
            entity_id: ID of entity affected
            action: Action performed (for resource events)
            details: Additional event details
            severity: Event severity level
            ip_address: Client IP address
            user_agent: Client user agent
            request_id: Request correlation ID

        Returns:
            Created AuditLog record
        """
        # Build changes/details dict
        changes = details or {}
        changes["event_type"] = event_type.value
        changes["severity"] = severity.value
        if request_id:
            changes["request_id"] = request_id

        # Map event type to AuditAction
        action_mapping = {
            "created": models.AuditAction.CREATE,
            "updated": models.AuditAction.UPDATE,
            "deleted": models.AuditAction.DELETE,
            "executed": models.AuditAction.EXECUTE,
        }

        audit_action = models.AuditAction.CREATE  # default
        if action and action.lower() in action_mapping:
            audit_action = action_mapping[action.lower()]
        elif "delete" in event_type.value or "revoke" in event_type.value:
            audit_action = models.AuditAction.DELETE
        elif "update" in event_type.value or "change" in event_type.value:
            audit_action = models.AuditAction.UPDATE
        elif "start" in event_type.value or "execute" in event_type.value:
            audit_action = models.AuditAction.EXECUTE

        # Create audit log entry
        audit_log = models.AuditLog(
            user_id=user_id,
            tenant_id=tenant_id,
            entity_type=entity_type or event_type.value.split(".")[0],
            entity_id=UUID(entity_id) if entity_id and entity_id != "None" else None,
            action=audit_action,
            changes=changes,
            ip_address=ip_address,
            user_agent=user_agent
        )

        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)

        # Also log to structured logger
        log_method = logger.info
        if severity == AuditSeverity.WARNING:
            log_method = logger.warning
        elif severity == AuditSeverity.ERROR:
            log_method = logger.error
        elif severity == AuditSeverity.CRITICAL:
            log_method = logger.critical

        log_method(
            "audit_event",
            event_type=event_type.value,
            user_id=str(user_id) if user_id else None,
            tenant_id=str(tenant_id) if tenant_id else None,
            entity_type=entity_type,
            entity_id=entity_id,
            severity=severity.value
        )

        return audit_log

    @classmethod
    def log_auth_event(
        cls,
        db: Session,
        event_type: AuditEventType,
        user: Optional[models.User] = None,
        request: Optional[Request] = None,
        success: bool = True,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log an authentication-related event."""
        severity = AuditSeverity.INFO if success else AuditSeverity.WARNING

        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.headers.get("user-agent")
            request_id = getattr(request.state, "request_id", None)

        return cls.log_event(
            db=db,
            event_type=event_type,
            user_id=user.id if user else None,
            tenant_id=user.tenant_id if user else None,
            entity_type="auth",
            details=details,
            severity=severity,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id
        )

    @classmethod
    def log_security_event(
        cls,
        event_type: AuditEventType,
        request: Optional[Request] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: AuditSeverity = AuditSeverity.WARNING
    ):
        """
        Log a security event (does not require DB session).

        For events that should always be logged even if DB is unavailable.
        """
        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.headers.get("user-agent")
            request_id = getattr(request.state, "request_id", None)

        log_method = logger.warning
        if severity == AuditSeverity.ERROR:
            log_method = logger.error
        elif severity == AuditSeverity.CRITICAL:
            log_method = logger.critical

        log_method(
            "security_event",
            event_type=event_type.value,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            details=details
        )

    @classmethod
    def log_resource_event(
        cls,
        db: Session,
        event_type: AuditEventType,
        user: models.User,
        entity_type: str,
        entity_id: str,
        action: str,
        changes: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ):
        """Log a resource CRUD event."""
        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.headers.get("user-agent")
            request_id = getattr(request.state, "request_id", None)

        return cls.log_event(
            db=db,
            event_type=event_type,
            user_id=user.id,
            tenant_id=user.tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            details=changes,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id
        )

    @classmethod
    def log_job_event(
        cls,
        db: Session,
        event_type: AuditEventType,
        job_run: models.JobRun,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log a job execution event."""
        return cls.log_event(
            db=db,
            event_type=event_type,
            user_id=job_run.trigger_user_id,
            tenant_id=job_run.tenant_id,
            entity_type="job_run",
            entity_id=str(job_run.id),
            action="execute",
            details=details
        )

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """Extract client IP from request."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        if request.client:
            return request.client.host

        return "unknown"


def audit_login_success(db: Session, user: models.User, request: Request):
    """Convenience function to log successful login."""
    AuditService.log_auth_event(
        db, AuditEventType.LOGIN_SUCCESS, user, request, success=True
    )


def audit_login_failed(db: Session, email: str, request: Request, reason: str):
    """Convenience function to log failed login."""
    AuditService.log_auth_event(
        db, AuditEventType.LOGIN_FAILED, None, request, success=False,
        details={"email": email, "reason": reason}
    )


def audit_logout(db: Session, user: models.User, request: Request):
    """Convenience function to log logout."""
    AuditService.log_auth_event(
        db, AuditEventType.LOGOUT, user, request
    )
