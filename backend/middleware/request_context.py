"""
Request context middleware.

Injects request IDs and tracks request metadata for logging and tracing.
"""

import time
import uuid
from typing import Callable, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import FastAPI

from core.logging import LogContext, get_logger

logger = get_logger(__name__)

# Header names for request tracking
REQUEST_ID_HEADER = "X-Request-ID"
CORRELATION_ID_HEADER = "X-Correlation-ID"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that manages request context for logging and tracing.

    Features:
    - Generates or propagates request IDs
    - Logs request start/end with timing
    - Injects context into all log messages
    - Adds request ID to response headers
    """

    def __init__(self, app: FastAPI, exclude_paths: Optional[list[str]] = None):
        """
        Initialize the middleware.

        Args:
            app: FastAPI application
            exclude_paths: Paths to exclude from logging (e.g., health checks)
        """
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/ready", "/docs", "/redoc", "/openapi.json"]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with context tracking."""
        # Generate or extract request ID
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or request_id

        # Store in request state for access by route handlers
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        # Check if path should be excluded from logging
        should_log = request.url.path not in self.exclude_paths

        # Bind context for all logs during this request
        LogContext.bind_request_context(
            request_id=request_id,
            path=request.url.path,
            method=request.method
        )

        # Log request start
        start_time = time.perf_counter()
        if should_log:
            logger.info(
                "request_started",
                client_ip=self._get_client_ip(request),
                user_agent=request.headers.get("user-agent", ""),
                query_string=str(request.query_params) if request.query_params else None
            )

        try:
            # Process request
            response = await call_next(request)

            # Calculate duration
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            # Log request completion
            if should_log:
                logger.info(
                    "request_completed",
                    status_code=response.status_code,
                    duration_ms=duration_ms
                )

            # Add request ID to response headers
            response.headers[REQUEST_ID_HEADER] = request_id
            response.headers[CORRELATION_ID_HEADER] = correlation_id
            response.headers["X-Response-Time"] = f"{duration_ms}ms"

            return response

        except Exception as e:
            # Calculate duration even for errors
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            logger.error(
                "request_failed",
                error=str(e),
                error_type=type(e).__name__,
                duration_ms=duration_ms,
                exc_info=True
            )
            raise

        finally:
            # Clear context after request
            LogContext.clear()

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, considering proxy headers."""
        # Check for forwarded headers (reverse proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP (original client)
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct connection
        if request.client:
            return request.client.host

        return "unknown"


def get_request_id(request: Request) -> str:
    """
    Get the request ID from a request object.

    Args:
        request: FastAPI/Starlette request

    Returns:
        Request ID string
    """
    return getattr(request.state, "request_id", "unknown")


def get_correlation_id(request: Request) -> str:
    """
    Get the correlation ID from a request object.

    Args:
        request: FastAPI/Starlette request

    Returns:
        Correlation ID string
    """
    return getattr(request.state, "correlation_id", "unknown")
