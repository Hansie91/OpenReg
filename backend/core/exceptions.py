"""
Custom exceptions for OpenReg.

Provides a hierarchy of exceptions for different error scenarios:
- Configuration errors (startup validation)
- Security/authentication errors
- Permission errors
"""


class OpenRegError(Exception):
    """Base exception for all OpenReg errors."""

    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code or "OPENREG_ERROR"
        super().__init__(self.message)


class ConfigurationError(OpenRegError):
    """Raised when configuration is invalid or missing required values."""

    def __init__(self, message: str, field: str = None):
        self.field = field
        code = f"CONFIG_ERROR_{field.upper()}" if field else "CONFIG_ERROR"
        super().__init__(message, code)


class SecurityConfigError(ConfigurationError):
    """Raised when security-sensitive configuration is invalid."""

    def __init__(self, message: str, field: str = None):
        super().__init__(f"SECURITY: {message}", field)


class TokenError(OpenRegError):
    """Base exception for token-related errors."""

    def __init__(self, message: str):
        super().__init__(message, "TOKEN_ERROR")


class TokenExpiredError(TokenError):
    """Raised when a token has expired."""

    def __init__(self):
        super().__init__("Token has expired")
        self.code = "TOKEN_EXPIRED"


class TokenRevokedError(TokenError):
    """Raised when a token has been revoked."""

    def __init__(self):
        super().__init__("Token has been revoked")
        self.code = "TOKEN_REVOKED"


class TokenInvalidError(TokenError):
    """Raised when a token is malformed or invalid."""

    def __init__(self, reason: str = "Invalid token"):
        super().__init__(reason)
        self.code = "TOKEN_INVALID"


class PermissionDeniedError(OpenRegError):
    """Raised when user lacks required permissions."""

    def __init__(self, permission: str = None, message: str = None):
        self.permission = permission
        msg = message or f"Permission denied: {permission} required"
        super().__init__(msg, "PERMISSION_DENIED")


class TenantIsolationError(OpenRegError):
    """Raised when attempting to access resources from another tenant."""

    def __init__(self, message: str = "Access denied: resource belongs to another tenant"):
        super().__init__(message, "TENANT_ISOLATION_ERROR")


class RateLimitError(OpenRegError):
    """Raised when rate limit is exceeded."""

    def __init__(self, retry_after: int = None):
        self.retry_after = retry_after
        message = "Rate limit exceeded"
        if retry_after:
            message += f". Retry after {retry_after} seconds"
        super().__init__(message, "RATE_LIMIT_EXCEEDED")


class StartupValidationError(ConfigurationError):
    """Raised during application startup when validation fails."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        message = f"Startup validation failed with {len(errors)} error(s):\n" + "\n".join(f"  - {e}" for e in errors)
        super().__init__(message, "STARTUP_VALIDATION")
