"""
Permission system for granular role-based access control.

Provides a hierarchical permission model with support for:
- Granular permissions (e.g., report:read, report:execute)
- Wildcard permissions (e.g., report:*, *:*)
- Decorator-based endpoint protection
- Role-permission mapping

Usage:
    from core.permissions import Permission, require_permissions

    @router.post("/reports")
    @require_permissions(Permission.REPORT_CREATE)
    async def create_report(
        current_user: User = Depends(get_current_user)
    ):
        ...
"""

from enum import Enum
from typing import List, Set, Union, Callable, Optional
from functools import wraps
from fastapi import Depends, HTTPException, status

import models
from services.auth import get_current_user


class Permission(str, Enum):
    """
    Granular permissions following resource:action pattern.

    Naming convention: RESOURCE_ACTION
    String value: resource:action

    Wildcards:
    - ADMIN grants all permissions
    - resource:* grants all actions on a resource
    """

    # === Admin ===
    ADMIN = "*:*"  # Full access to everything

    # === Reports ===
    REPORT_READ = "report:read"
    REPORT_CREATE = "report:create"
    REPORT_UPDATE = "report:update"
    REPORT_DELETE = "report:delete"
    REPORT_EXECUTE = "report:execute"
    REPORT_APPROVE = "report:approve"
    REPORT_ALL = "report:*"

    # === Connectors ===
    CONNECTOR_READ = "connector:read"
    CONNECTOR_CREATE = "connector:create"
    CONNECTOR_UPDATE = "connector:update"
    CONNECTOR_DELETE = "connector:delete"
    CONNECTOR_TEST = "connector:test"
    CONNECTOR_ALL = "connector:*"

    # === Schedules ===
    SCHEDULE_READ = "schedule:read"
    SCHEDULE_CREATE = "schedule:create"
    SCHEDULE_UPDATE = "schedule:update"
    SCHEDULE_DELETE = "schedule:delete"
    SCHEDULE_ALL = "schedule:*"

    # === Jobs ===
    JOB_READ = "job:read"
    JOB_EXECUTE = "job:execute"
    JOB_CANCEL = "job:cancel"
    JOB_ALL = "job:*"

    # === Validations ===
    VALIDATION_READ = "validation:read"
    VALIDATION_CREATE = "validation:create"
    VALIDATION_UPDATE = "validation:update"
    VALIDATION_DELETE = "validation:delete"
    VALIDATION_ALL = "validation:*"

    # === Mappings ===
    MAPPING_READ = "mapping:read"
    MAPPING_CREATE = "mapping:create"
    MAPPING_UPDATE = "mapping:update"
    MAPPING_DELETE = "mapping:delete"
    MAPPING_ALL = "mapping:*"

    # === Destinations ===
    DESTINATION_READ = "destination:read"
    DESTINATION_CREATE = "destination:create"
    DESTINATION_UPDATE = "destination:update"
    DESTINATION_DELETE = "destination:delete"
    DESTINATION_TEST = "destination:test"
    DESTINATION_ALL = "destination:*"

    # === Users (tenant admin) ===
    USER_READ = "user:read"
    USER_CREATE = "user:create"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    USER_ALL = "user:*"

    # === Roles ===
    ROLE_READ = "role:read"
    ROLE_CREATE = "role:create"
    ROLE_UPDATE = "role:update"
    ROLE_DELETE = "role:delete"
    ROLE_ASSIGN = "role:assign"
    ROLE_ALL = "role:*"

    # === API Keys ===
    API_KEY_READ = "apikey:read"
    API_KEY_CREATE = "apikey:create"
    API_KEY_REVOKE = "apikey:revoke"
    API_KEY_ALL = "apikey:*"

    # === Audit ===
    AUDIT_READ = "audit:read"

    # === Exceptions (validation failures) ===
    EXCEPTION_READ = "exception:read"
    EXCEPTION_AMEND = "exception:amend"
    EXCEPTION_ALL = "exception:*"

    # === Webhooks ===
    WEBHOOK_READ = "webhook:read"
    WEBHOOK_CREATE = "webhook:create"
    WEBHOOK_UPDATE = "webhook:update"
    WEBHOOK_DELETE = "webhook:delete"
    WEBHOOK_ALL = "webhook:*"

    # === Schemas ===
    SCHEMA_READ = "schema:read"
    SCHEMA_CREATE = "schema:create"
    SCHEMA_UPDATE = "schema:update"
    SCHEMA_DELETE = "schema:delete"
    SCHEMA_ALL = "schema:*"

    # === Streaming ===
    STREAMING_READ = "streaming:read"
    STREAMING_CREATE = "streaming:create"
    STREAMING_UPDATE = "streaming:update"
    STREAMING_DELETE = "streaming:delete"
    STREAMING_ALL = "streaming:*"


# Built-in role templates
ROLE_TEMPLATES = {
    "admin": [Permission.ADMIN],
    "report_manager": [
        Permission.REPORT_ALL,
        Permission.CONNECTOR_READ,
        Permission.SCHEDULE_ALL,
        Permission.JOB_ALL,
        Permission.VALIDATION_ALL,
        Permission.MAPPING_READ,
        Permission.DESTINATION_READ,
        Permission.EXCEPTION_ALL,
    ],
    "report_viewer": [
        Permission.REPORT_READ,
        Permission.JOB_READ,
        Permission.VALIDATION_READ,
        Permission.EXCEPTION_READ,
    ],
    "connector_admin": [
        Permission.CONNECTOR_ALL,
        Permission.DESTINATION_ALL,
    ],
    "exception_handler": [
        Permission.REPORT_READ,
        Permission.JOB_READ,
        Permission.EXCEPTION_ALL,
    ],
    "auditor": [
        Permission.REPORT_READ,
        Permission.JOB_READ,
        Permission.AUDIT_READ,
        Permission.EXCEPTION_READ,
    ],
    "api_integrator": [
        Permission.API_KEY_ALL,
        Permission.WEBHOOK_ALL,
        Permission.REPORT_READ,
        Permission.JOB_READ,
        Permission.JOB_EXECUTE,
    ],
}


def parse_permission(perm_str: str) -> tuple:
    """
    Parse a permission string into (resource, action) tuple.

    Args:
        perm_str: Permission string like "report:read" or "*:*"

    Returns:
        Tuple of (resource, action)
    """
    if ':' not in perm_str:
        return (perm_str, '*')
    parts = perm_str.split(':', 1)
    return (parts[0], parts[1])


def permission_matches(user_perm: str, required_perm: str) -> bool:
    """
    Check if a user permission grants access to a required permission.

    Supports wildcards:
    - "*:*" matches everything
    - "resource:*" matches all actions on resource

    Args:
        user_perm: Permission the user has
        required_perm: Permission required for the action

    Returns:
        True if user_perm grants required_perm
    """
    user_resource, user_action = parse_permission(user_perm)
    req_resource, req_action = parse_permission(required_perm)

    # Full wildcard matches everything
    if user_resource == '*' and user_action == '*':
        return True

    # Resource must match (or user has wildcard)
    if user_resource != '*' and user_resource != req_resource:
        return False

    # Action must match (or user has wildcard)
    if user_action != '*' and user_action != req_action:
        return False

    return True


def has_permission(
    user_permissions: List[str],
    required: Union[Permission, str]
) -> bool:
    """
    Check if user has a specific permission.

    Args:
        user_permissions: List of permission strings the user has
        required: The required permission

    Returns:
        True if user has the required permission
    """
    required_str = required.value if isinstance(required, Permission) else required

    for user_perm in user_permissions:
        if permission_matches(user_perm, required_str):
            return True

    return False


def has_any_permission(
    user_permissions: List[str],
    required: List[Union[Permission, str]]
) -> bool:
    """
    Check if user has any of the specified permissions.

    Args:
        user_permissions: List of permission strings the user has
        required: List of permissions, any of which grants access

    Returns:
        True if user has at least one of the required permissions
    """
    return any(has_permission(user_permissions, perm) for perm in required)


def has_all_permissions(
    user_permissions: List[str],
    required: List[Union[Permission, str]]
) -> bool:
    """
    Check if user has all of the specified permissions.

    Args:
        user_permissions: List of permission strings the user has
        required: List of permissions, all of which are required

    Returns:
        True if user has all required permissions
    """
    return all(has_permission(user_permissions, perm) for perm in required)


def get_user_permissions(user: models.User, db) -> List[str]:
    """
    Get all permissions for a user based on their roles.

    Also grants superuser full access.

    Args:
        user: The user to get permissions for
        db: Database session

    Returns:
        List of permission strings
    """
    permissions = set()

    # Superusers get full access
    if user.is_superuser:
        permissions.add(Permission.ADMIN.value)
        return list(permissions)

    # Collect permissions from all roles
    for user_role in user.roles:
        role = user_role.role
        if role and role.permissions:
            for perm in role.permissions:
                permissions.add(perm)

    return list(permissions)


def require_permissions(
    *required: Union[Permission, str],
    require_all: bool = False
) -> Callable:
    """
    Decorator to require specific permissions for an endpoint.

    Can be used with single or multiple permissions:
    - Single: @require_permissions(Permission.REPORT_READ)
    - Any of: @require_permissions(Permission.REPORT_READ, Permission.REPORT_UPDATE)
    - All of: @require_permissions(Permission.REPORT_READ, Permission.JOB_EXECUTE, require_all=True)

    Args:
        *required: One or more required permissions
        require_all: If True, user must have all permissions; if False, any permission grants access

    Returns:
        Decorated function that checks permissions before execution
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current_user from kwargs (injected by Depends)
            current_user = kwargs.get('current_user')
            if current_user is None:
                # Try to find it in the function signature's default dependencies
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Permission check requires current_user dependency"
                )

            # Get database session from kwargs
            db = kwargs.get('db')
            if db is None:
                # Permission check without DB - use user's preloaded roles
                user_permissions = []
                if current_user.is_superuser:
                    user_permissions = [Permission.ADMIN.value]
                else:
                    for user_role in current_user.roles:
                        role = user_role.role
                        if role and role.permissions:
                            user_permissions.extend(role.permissions)
            else:
                user_permissions = get_user_permissions(current_user, db)

            # Check permissions
            required_list = list(required)
            if require_all:
                allowed = has_all_permissions(user_permissions, required_list)
            else:
                allowed = has_any_permission(user_permissions, required_list)

            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


class PermissionChecker:
    """
    Dependency class for checking permissions in FastAPI endpoints.

    Usage:
        @router.get("/reports")
        async def list_reports(
            current_user: User = Depends(get_current_user),
            _: bool = Depends(PermissionChecker(Permission.REPORT_READ))
        ):
            ...
    """

    def __init__(
        self,
        *required: Union[Permission, str],
        require_all: bool = False
    ):
        self.required = list(required)
        self.require_all = require_all

    async def __call__(
        self,
        current_user: models.User = Depends(get_current_user)
    ) -> bool:
        """Check if user has required permissions."""
        # Get permissions from user
        user_permissions = []
        if current_user.is_superuser:
            user_permissions = [Permission.ADMIN.value]
        else:
            for user_role in current_user.roles:
                role = user_role.role
                if role and role.permissions:
                    user_permissions.extend(role.permissions)

        # Check permissions
        if self.require_all:
            allowed = has_all_permissions(user_permissions, self.required)
        else:
            allowed = has_any_permission(user_permissions, self.required)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        return True


def check_permission(
    user: models.User,
    required: Union[Permission, str],
    db = None
) -> bool:
    """
    Check if a user has a specific permission.

    Convenience function for use outside of request context.

    Args:
        user: The user to check
        required: The required permission
        db: Optional database session for loading roles

    Returns:
        True if user has permission, False otherwise
    """
    if user.is_superuser:
        return True

    user_permissions = []
    for user_role in user.roles:
        role = user_role.role
        if role and role.permissions:
            user_permissions.extend(role.permissions)

    return has_permission(user_permissions, required)
