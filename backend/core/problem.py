"""
RFC 9457 Problem Details exception classes for API responses.

This module provides standardized error responses following RFC 9457 (Problem Details for HTTP APIs).
All API errors should use these exception classes for consistent, actionable error messages.

Usage:
    from core.problem import NotFoundError, AuthenticationError

    # In an endpoint:
    raise NotFoundError(detail="Report with ID 'abc-123' was not found. Verify the ID is correct.")

Each problem response includes:
- type: A URI identifying the problem type (e.g., "https://openreg.io/problems/not-found")
- title: A short, human-readable summary (e.g., "Resource Not Found")
- status: The HTTP status code (e.g., 404)
- detail: A human-readable explanation with actionable guidance
- instance: The request path where the error occurred
- request_id: The unique request ID for debugging (added by exception handler)

Note: This module is for API responses only. Internal exceptions should use core/exceptions.py.
"""

from typing import Any
from fastapi_problem.error import (
    Problem,
    NotFoundProblem,
    UnprocessableProblem,
    BadRequestProblem,
    UnauthorisedProblem,
    ForbiddenProblem,
    ConflictProblem,
    ServerProblem,
)


# Base URI for OpenReg problem types
PROBLEM_BASE_URI = "https://openreg.io/problems"


class NotFoundError(NotFoundProblem):
    """
    404 Not Found - Resource does not exist.

    Use when a requested resource (report, connector, etc.) cannot be found.

    Example:
        raise NotFoundError(detail="Report with ID 'abc-123' was not found. Verify the ID is correct.")
    """

    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/not-found",
            **kwargs
        )


class ValidationError(UnprocessableProblem):
    """
    422 Unprocessable Entity - Validation failed.

    Use when request data fails validation rules.

    Example:
        raise ValidationError(
            detail="Report configuration is invalid. Field 'source_table' is required.",
            errors=[{"field": "source_table", "message": "This field is required"}]
        )
    """

    def __init__(self, detail: str, errors: list[dict] | None = None, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/validation-failed",
            errors=errors or [],
            **kwargs
        )


class AuthenticationError(UnauthorisedProblem):
    """
    401 Unauthorized - Authentication failed.

    Use when user credentials are invalid or session has expired.

    Example:
        raise AuthenticationError(detail="Invalid email or password. Please check your credentials and try again.")
    """

    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/authentication-failed",
            **kwargs
        )


class PermissionError(ForbiddenProblem):
    """
    403 Forbidden - Permission denied.

    Use when user is authenticated but lacks required permissions.

    Example:
        raise PermissionError(detail="You do not have permission to delete this report. Contact your administrator.")
    """

    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/permission-denied",
            **kwargs
        )


class BadRequestError(BadRequestProblem):
    """
    400 Bad Request - Request is malformed or missing required data.

    Use when the request itself is invalid (not validation errors on data).

    Example:
        raise BadRequestError(detail="Request body must be valid JSON. Check your request format.")
    """

    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/bad-request",
            **kwargs
        )


class ConflictError(ConflictProblem):
    """
    409 Conflict - Resource state conflict.

    Use when the request conflicts with current resource state.

    Example:
        raise ConflictError(detail="Destination is already linked to this report.")
    """

    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/conflict",
            **kwargs
        )


class ServiceUnavailableError(ServerProblem):
    """
    503 Service Unavailable - External service is unavailable.

    Use when an external dependency (database, API) is unreachable.

    Example:
        raise ServiceUnavailableError(detail="Could not connect to database. Check connection settings.")
    """

    def __init__(self, detail: str, **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/service-unavailable",
            status=503,
            **kwargs
        )


class InternalError(ServerProblem):
    """
    500 Internal Server Error - Unexpected server error.

    Use as a fallback for unexpected errors. Always log full details internally.
    Never expose stack traces or internal details to clients.

    Example:
        raise InternalError(detail="An unexpected error occurred. Please try again or contact support.")
    """

    def __init__(self, detail: str = "An unexpected error occurred. Please try again or contact support.", **kwargs: Any) -> None:
        super().__init__(
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/internal-error",
            status=500,
            **kwargs
        )


class RateLimitError(Problem):
    """
    429 Too Many Requests - Rate limit exceeded.

    Use when client has exceeded rate limits.

    Example:
        raise RateLimitError(detail="Rate limit exceeded. Please wait 60 seconds before retrying.", retry_after=60)
    """

    def __init__(self, detail: str, retry_after: int | None = None, **kwargs: Any) -> None:
        from multidict import CIMultiDict
        headers = CIMultiDict()
        if retry_after:
            headers["Retry-After"] = str(retry_after)
        super().__init__(
            title="Too Many Requests",
            detail=detail,
            type_=f"{PROBLEM_BASE_URI}/rate-limit-exceeded",
            status=429,
            headers=headers if retry_after else None,
            retry_after=retry_after,
            **kwargs
        )


# Export all problem classes
__all__ = [
    "NotFoundError",
    "ValidationError",
    "AuthenticationError",
    "PermissionError",
    "BadRequestError",
    "ConflictError",
    "ServiceUnavailableError",
    "InternalError",
    "RateLimitError",
    "PROBLEM_BASE_URI",
]
