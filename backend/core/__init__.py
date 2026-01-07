"""
Core utilities package for OpenReg.

Contains security utilities, exceptions, and configuration validation.
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
from .tenancy import (
    TenantContext,
    TenantScopedSession,
    get_tenant_db,
    get_current_tenant_id,
    set_tenant_id,
    clear_tenant_id,
    create_tenant_session,
    require_tenant_match,
    tenant_filter,
    verify_tenant_access,
)
from .permissions import (
    Permission,
    ROLE_TEMPLATES,
    has_permission,
    has_any_permission,
    has_all_permissions,
    get_user_permissions,
    require_permissions,
    PermissionChecker,
    check_permission,
)

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
