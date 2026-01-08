"""
Core utilities package for OpenReg.

Contains security utilities, exceptions, and configuration validation.

Note: Tenancy imports are lazy to avoid circular imports with services.auth.
Use `from core.tenancy import ...` directly if needed.
"""

from .exceptions import (
    OpenRegError,
    ConfigurationError,
    SecurityConfigError,
    TokenError,
    TokenExpiredError,
    TokenRevokedError,
    TokenInvalidError,
    PermissionDeniedError,
    TenantIsolationError,
    RateLimitError,
    StartupValidationError,
)
from .security import (
    generate_secret_key,
    generate_fernet_key,
    generate_api_key,
    hash_api_key,
    get_api_key_prefix,
    generate_jti,
    is_weak_secret,
    validate_fernet_key,
    constant_time_compare,
)
# Lazy imports for tenancy and permissions to avoid circular imports with services.auth
# These are imported on first access via __getattr__
_tenancy_exports = [
    "TenantContext",
    "TenantScopedSession",
    "get_tenant_db",
    "get_current_tenant_id",
    "set_tenant_id",
    "clear_tenant_id",
    "create_tenant_session",
    "require_tenant_match",
    "tenant_filter",
    "verify_tenant_access",
]

_permissions_exports = [
    "Permission",
    "ROLE_TEMPLATES",
    "has_permission",
    "has_any_permission",
    "has_all_permissions",
    "get_user_permissions",
    "require_permissions",
    "PermissionChecker",
    "check_permission",
]

def __getattr__(name):
    """Lazy import for tenancy and permissions modules to avoid circular imports."""
    if name in _tenancy_exports:
        from . import tenancy
        return getattr(tenancy, name)
    if name in _permissions_exports:
        from . import permissions
        return getattr(permissions, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    # Exceptions
    "OpenRegError",
    "ConfigurationError",
    "SecurityConfigError",
    "TokenError",
    "TokenExpiredError",
    "TokenRevokedError",
    "TokenInvalidError",
    "PermissionDeniedError",
    "TenantIsolationError",
    "RateLimitError",
    "StartupValidationError",
    # Security utilities
    "generate_secret_key",
    "generate_fernet_key",
    "generate_api_key",
    "hash_api_key",
    "get_api_key_prefix",
    "generate_jti",
    "is_weak_secret",
    "validate_fernet_key",
    "constant_time_compare",
    # Tenancy
    "TenantContext",
    "TenantScopedSession",
    "get_tenant_db",
    "get_current_tenant_id",
    "set_tenant_id",
    "clear_tenant_id",
    "create_tenant_session",
    "require_tenant_match",
    "tenant_filter",
    "verify_tenant_access",
    # Permissions
    "Permission",
    "ROLE_TEMPLATES",
    "has_permission",
    "has_any_permission",
    "has_all_permissions",
    "get_user_permissions",
    "require_permissions",
    "PermissionChecker",
    "check_permission",
]
