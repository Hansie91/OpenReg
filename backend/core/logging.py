"""
Structured logging configuration using structlog.

Provides consistent, JSON-formatted logging across the application
with automatic context injection (request IDs, tenant IDs, etc.).
"""

import logging
import sys
from typing import Any, Dict, Optional
import structlog
from structlog.types import Processor

from config import settings


def add_log_level(
    logger: logging.Logger, method_name: str, event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """Add log level to the event dict."""
    event_dict["level"] = method_name.upper()
    return event_dict


def add_service_info(
    logger: logging.Logger, method_name: str, event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """Add service information to logs."""
    event_dict["service"] = "openreg"
    event_dict["environment"] = settings.ENVIRONMENT
    return event_dict


def censor_sensitive_data(
    logger: logging.Logger, method_name: str, event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """Censor sensitive fields from logs."""
    sensitive_keys = {
        "password", "secret", "token", "api_key", "apikey",
        "authorization", "credentials", "private_key", "access_token",
        "refresh_token", "session_id", "credit_card", "ssn"
    }

    def censor_dict(d: Dict[str, Any]) -> Dict[str, Any]:
        censored = {}
        for key, value in d.items():
            key_lower = key.lower()
            if any(sensitive in key_lower for sensitive in sensitive_keys):
                censored[key] = "[REDACTED]"
            elif isinstance(value, dict):
                censored[key] = censor_dict(value)
            elif isinstance(value, list):
                censored[key] = [
                    censor_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                censored[key] = value
        return censored

    return censor_dict(event_dict)


def configure_logging(
    json_format: bool = True,
    log_level: str = "INFO"
) -> None:
    """
    Configure structured logging for the application.

    Args:
        json_format: If True, output logs as JSON (for production).
                    If False, use colored console output (for development).
        log_level: Minimum log level to output.
    """
    # Determine if we should use JSON based on environment
    if json_format is None:
        json_format = settings.ENVIRONMENT == "production"

    # Shared processors for all outputs
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        add_log_level,
        add_service_info,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        censor_sensitive_data,
    ]

    if json_format:
        # Production: JSON output
        processors = shared_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ]
    else:
        # Development: Colored console output
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # Set levels for noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: Optional[str] = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (typically __name__ of the module)

    Returns:
        Configured structlog logger
    """
    return structlog.get_logger(name)


# Context management for request-scoped data
class LogContext:
    """Helper for managing logging context."""

    @staticmethod
    def bind(**kwargs: Any) -> None:
        """Bind values to the current logging context."""
        structlog.contextvars.bind_contextvars(**kwargs)

    @staticmethod
    def unbind(*keys: str) -> None:
        """Remove values from the current logging context."""
        structlog.contextvars.unbind_contextvars(*keys)

    @staticmethod
    def clear() -> None:
        """Clear all context values."""
        structlog.contextvars.clear_contextvars()

    @staticmethod
    def bind_request_context(
        request_id: str,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        path: Optional[str] = None,
        method: Optional[str] = None
    ) -> None:
        """Bind common request context values."""
        context = {"request_id": request_id}
        if tenant_id:
            context["tenant_id"] = tenant_id
        if user_id:
            context["user_id"] = user_id
        if path:
            context["path"] = path
        if method:
            context["method"] = method
        LogContext.bind(**context)


# Pre-configured logger for quick imports
logger = get_logger("openreg")
