"""
Tenant scoping for multi-tenant row-level security.

Provides automatic tenant_id filtering on queries to ensure
data isolation between tenants without requiring explicit
filters in every query.

Usage:
    from core.tenancy import get_tenant_db, TenantContext

    @router.get("/reports")
    async def list_reports(
        db: Session = Depends(get_tenant_db)
    ):
        # Queries are automatically filtered by tenant_id
        reports = db.query(Report).all()
        return reports
"""

from typing import Generator, Optional, Any, Type, TypeVar
from functools import wraps
from contextvars import ContextVar
from sqlalchemy.orm import Session, Query
from sqlalchemy import event
from fastapi import Depends, HTTPException, status

from database import SessionLocal, Base
import models

# Context variable to store current tenant_id across async boundaries
_current_tenant_id: ContextVar[Optional[str]] = ContextVar('current_tenant_id', default=None)

# Type var for generic model types
T = TypeVar('T', bound=Base)

# Models that should have tenant filtering applied
TENANT_SCOPED_MODELS = {
    'User', 'Role', 'UserRole', 'Connector', 'Report', 'ReportVersion',
    'ReportValidation', 'ReportSchema', 'XBRLTaxonomy', 'MappingSet',
    'CrossReferenceEntry', 'ValidationRule', 'ValidationResult',
    'ValidationException', 'Schedule', 'Trigger', 'JobRun', 'Artifact',
    'Destination', 'ReportDestination', 'DeliveryAttempt', 'AuditLog',
    'FileSubmission', 'RecordSubmission', 'RecordStatusHistory',
    'JobRunLog', 'RegulatorResponse', 'StreamingTopic', 'StreamingBuffer',
    'StreamingConsumerState', 'LineageNode', 'LineageEdge'
}


class TenantContext:
    """
    Context manager for setting tenant scope.

    Usage:
        with TenantContext(tenant_id):
            # All queries in this block are tenant-scoped
            reports = db.query(Report).all()
    """

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.token = None

    def __enter__(self):
        self.token = _current_tenant_id.set(self.tenant_id)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        _current_tenant_id.reset(self.token)
        return False


def get_current_tenant_id() -> Optional[str]:
    """Get the current tenant_id from context."""
    return _current_tenant_id.get()


def set_tenant_id(tenant_id: str) -> None:
    """Set the current tenant_id in context."""
    _current_tenant_id.set(tenant_id)


def clear_tenant_id() -> None:
    """Clear the current tenant_id from context."""
    _current_tenant_id.set(None)


class TenantScopedSession(Session):
    """
    SQLAlchemy session that automatically applies tenant filtering.

    When a tenant_id is set in context, all queries on tenant-scoped
    models will automatically include a WHERE tenant_id = :tenant_id clause.
    """

    def __init__(self, *args, tenant_id: Optional[str] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._tenant_id = tenant_id

    @property
    def tenant_id(self) -> Optional[str]:
        """Get tenant_id from instance or context."""
        return self._tenant_id or get_current_tenant_id()

    def query(self, *entities, **kwargs) -> Query:
        """
        Override query to apply tenant filtering automatically.

        Filters are applied only to models that have tenant_id column
        and are in the TENANT_SCOPED_MODELS set.
        """
        q = super().query(*entities, **kwargs)

        tenant_id = self.tenant_id
        if not tenant_id:
            return q

        # Apply tenant filter to each entity that has tenant_id
        for entity in entities:
            model = entity if isinstance(entity, type) else getattr(entity, 'class_', None)
            if model is None:
                continue

            model_name = model.__name__ if hasattr(model, '__name__') else None
            if model_name not in TENANT_SCOPED_MODELS:
                continue

            if hasattr(model, 'tenant_id'):
                q = q.filter(model.tenant_id == tenant_id)

        return q

    def add(self, instance, _warn=True):
        """
        Override add to automatically set tenant_id on new instances.
        """
        tenant_id = self.tenant_id
        if tenant_id and hasattr(instance, 'tenant_id'):
            model_name = instance.__class__.__name__
            if model_name in TENANT_SCOPED_MODELS:
                # Only set if not already set
                if instance.tenant_id is None:
                    instance.tenant_id = tenant_id

        return super().add(instance, _warn=_warn)


def create_tenant_session(tenant_id: str) -> TenantScopedSession:
    """
    Create a new tenant-scoped database session.

    Args:
        tenant_id: The tenant ID to scope queries to

    Returns:
        A session that automatically filters by tenant_id
    """
    return TenantScopedSession(
        bind=SessionLocal.kw['bind'],
        tenant_id=tenant_id,
        autocommit=False,
        autoflush=False
    )


async def get_tenant_db(
    current_user: models.User = Depends(lambda: _get_current_user_dependency())
) -> Generator[TenantScopedSession, None, None]:
    """
    FastAPI dependency that provides a tenant-scoped database session.

    The tenant_id is extracted from the authenticated user's tenant.
    All queries using this session are automatically filtered by tenant.

    Usage:
        @router.get("/items")
        async def list_items(db: Session = Depends(get_tenant_db)):
            # Automatically filtered by user's tenant
            return db.query(Item).all()
    """
    tenant_id = str(current_user.tenant_id)
    db = create_tenant_session(tenant_id)

    # Also set context for any nested operations
    with TenantContext(tenant_id):
        try:
            yield db
        finally:
            db.close()


def _get_current_user_dependency():
    """
    Lazy import to avoid circular dependency.
    Returns the get_current_user function from auth service.
    """
    from services.auth import get_current_user
    return Depends(get_current_user)


# Actual dependency with proper injection
from services.auth import get_current_user

async def get_tenant_db_impl(
    current_user: models.User = Depends(get_current_user)
) -> Generator[TenantScopedSession, None, None]:
    """
    Actual implementation of tenant-scoped DB dependency.
    """
    tenant_id = str(current_user.tenant_id)
    db = create_tenant_session(tenant_id)

    with TenantContext(tenant_id):
        try:
            yield db
        finally:
            db.close()


# Export the actual dependency
get_tenant_db = get_tenant_db_impl


def require_tenant_match(
    resource_tenant_id: str,
    user_tenant_id: str,
    resource_name: str = "resource"
) -> None:
    """
    Verify that a resource belongs to the user's tenant.

    Raises HTTPException if tenant mismatch detected.
    Use this for explicit checks when loading resources by ID.

    Args:
        resource_tenant_id: The tenant_id of the resource
        user_tenant_id: The tenant_id of the current user
        resource_name: Name for error message

    Raises:
        HTTPException: 404 if tenant mismatch (security: don't reveal existence)
    """
    if str(resource_tenant_id) != str(user_tenant_id):
        # Return 404 instead of 403 to not reveal resource existence
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_name} not found"
        )


def tenant_filter(query: Query, model: Type[T], tenant_id: str) -> Query:
    """
    Apply tenant filter to an existing query.

    Useful when working with regular sessions but need tenant filtering.

    Args:
        query: The SQLAlchemy query to filter
        model: The model class being queried
        tenant_id: The tenant_id to filter by

    Returns:
        Filtered query
    """
    if hasattr(model, 'tenant_id'):
        return query.filter(model.tenant_id == tenant_id)
    return query


class TenantIsolationError(Exception):
    """Raised when tenant isolation is violated."""
    pass


def verify_tenant_access(
    instance: Any,
    tenant_id: str,
    raise_exception: bool = True
) -> bool:
    """
    Verify that an instance belongs to the specified tenant.

    Args:
        instance: The model instance to check
        tenant_id: The tenant_id to verify against
        raise_exception: If True, raise on mismatch; if False, return bool

    Returns:
        True if access is allowed

    Raises:
        TenantIsolationError: If raise_exception=True and mismatch detected
    """
    if not hasattr(instance, 'tenant_id'):
        return True

    if str(instance.tenant_id) != str(tenant_id):
        if raise_exception:
            raise TenantIsolationError(
                f"Tenant isolation violation: attempted to access "
                f"{instance.__class__.__name__} belonging to different tenant"
            )
        return False

    return True
