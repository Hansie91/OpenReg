"""
Rate limiting middleware using SlowAPI.

Provides configurable rate limiting with:
- Default limits per endpoint
- Tier-based limits for API keys
- Custom limits per route
- Redis-backed storage for distributed deployments
"""

from typing import Callable, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from core.logging import get_logger

logger = get_logger(__name__)


def get_identifier(request: Request) -> str:
    """
    Get rate limit identifier from request.

    Priority:
    1. API key (if present)
    2. Authenticated user ID
    3. Client IP address
    """
    # Check for API key
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Use first 16 chars of API key as identifier
        return f"apikey:{api_key[:16]}"

    # Check for authenticated user (set by auth middleware)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    # Fall back to IP address
    return get_remote_address(request)


def get_api_key_limit(request: Request) -> str:
    """
    Get rate limit based on API key tier.

    Returns appropriate limit string based on API key's rate_limit_per_minute.
    """
    # Default limit
    default_limit = f"{settings.RATE_LIMIT_PER_MINUTE}/minute"

    api_key_header = request.headers.get("X-API-Key")
    if not api_key_header:
        return default_limit

    # Get API key from database to check its limit
    # This is cached by the auth layer, so we access via request state
    api_key_limit = getattr(request.state, "api_key_rate_limit", None)
    if api_key_limit:
        return f"{api_key_limit}/minute"

    return default_limit


# Create limiter instance
# Use Redis for distributed rate limiting in production
storage_uri = None
if settings.REDIS_URL:
    storage_uri = settings.REDIS_URL

limiter = Limiter(
    key_func=get_identifier,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
    storage_uri=storage_uri,
    strategy="fixed-window",  # or "moving-window" for more accuracy
    headers_enabled=True,  # Add X-RateLimit-* headers to responses
)


def get_rate_limiter() -> Limiter:
    """Get the configured rate limiter instance."""
    return limiter


class RateLimitMiddleware:
    """
    Rate limiting middleware wrapper.

    Provides integration with FastAPI and custom error handling.
    """

    def __init__(self, app: FastAPI):
        """
        Initialize rate limiting for the application.

        Args:
            app: FastAPI application instance
        """
        self.app = app

        # Add limiter to app state
        app.state.limiter = limiter

        # Add SlowAPI middleware
        app.add_middleware(SlowAPIMiddleware)

        # Add custom exception handler
        app.add_exception_handler(RateLimitExceeded, self._rate_limit_handler)

        logger.info(
            "rate_limiting_configured",
            default_limit=f"{settings.RATE_LIMIT_PER_MINUTE}/minute",
            storage="redis" if storage_uri else "memory"
        )

    async def _rate_limit_handler(
        self, request: Request, exc: RateLimitExceeded
    ) -> JSONResponse:
        """Custom handler for rate limit exceeded errors."""
        # Log the rate limit event
        logger.warning(
            "rate_limit_exceeded",
            identifier=get_identifier(request),
            path=request.url.path,
            limit=str(exc.detail)
        )

        # Emit audit event
        try:
            from services.audit import AuditService, AuditEventType
            AuditService.log_security_event(
                event_type=AuditEventType.RATE_LIMIT_EXCEEDED,
                request=request,
                details={"limit": str(exc.detail), "path": request.url.path}
            )
        except Exception:
            pass  # Don't fail if audit logging fails

        return JSONResponse(
            status_code=429,
            content={
                "error": "rate_limit_exceeded",
                "message": "Too many requests. Please slow down.",
                "detail": str(exc.detail),
                "retry_after": exc.retry_after if hasattr(exc, "retry_after") else 60
            },
            headers={
                "Retry-After": str(exc.retry_after if hasattr(exc, "retry_after") else 60),
                "X-RateLimit-Limit": str(settings.RATE_LIMIT_PER_MINUTE),
            }
        )


# Decorator for custom endpoint limits
def rate_limit(limit: str):
    """
    Decorator to apply custom rate limit to an endpoint.

    Usage:
        @router.get("/expensive-operation")
        @rate_limit("10/minute")
        async def expensive_operation():
            ...

    Args:
        limit: Rate limit string (e.g., "10/minute", "100/hour")
    """
    return limiter.limit(limit)


# Pre-defined limit decorators for common use cases
def limit_heavy():
    """Rate limit for heavy/expensive operations (10/minute)."""
    return limiter.limit("10/minute")


def limit_standard():
    """Standard rate limit (60/minute)."""
    return limiter.limit("60/minute")


def limit_relaxed():
    """Relaxed rate limit for lightweight operations (200/minute)."""
    return limiter.limit("200/minute")


def limit_auth():
    """Strict rate limit for auth endpoints (5/minute)."""
    return limiter.limit("5/minute")


def limit_by_api_key():
    """Rate limit based on API key's configured limit."""
    return limiter.limit(get_api_key_limit)
