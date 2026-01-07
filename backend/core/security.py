"""
Security utilities for OpenReg.

Provides centralized security-related functions:
- Secret validation
- Secure random generation
- Hash utilities
"""

import secrets
import hashlib
import base64
from typing import Optional


def generate_secret_key(length: int = 32) -> str:
    """Generate a cryptographically secure random secret key."""
    return secrets.token_urlsafe(length)


def generate_fernet_key() -> str:
    """Generate a valid Fernet encryption key (32 bytes, base64-encoded)."""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()


def generate_api_key() -> tuple[str, str]:
    """
    Generate an API key and its hash.

    Returns:
        tuple: (plain_key, key_hash) - Store only the hash, return plain_key to user once
    """
    plain_key = f"openreg_{secrets.token_urlsafe(32)}"
    key_hash = hash_api_key(plain_key)
    return plain_key, key_hash


def hash_api_key(api_key: str) -> str:
    """Hash an API key for storage using SHA-256."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def get_api_key_prefix(api_key: str) -> str:
    """Get the prefix of an API key for identification (first 8 chars after 'openreg_')."""
    if api_key.startswith("openreg_"):
        return api_key[8:16]  # First 8 chars after prefix
    return api_key[:8]


def generate_jti() -> str:
    """Generate a unique JWT ID (jti) for token tracking."""
    return secrets.token_urlsafe(16)


def is_weak_secret(secret: str) -> bool:
    """
    Check if a secret appears to be a weak/default value.

    Returns True if the secret:
    - Is too short (< 32 chars)
    - Contains common weak patterns
    - Looks like a placeholder
    """
    if not secret:
        return True

    if len(secret) < 32:
        return True

    weak_patterns = [
        "your-secret",
        "change-me",
        "changeme",
        "secret-key",
        "default",
        "password",
        "12345",
        "example",
        "placeholder",
        "todo",
        "fixme",
        "development",
        "dev-key",
        "test-key",
    ]

    secret_lower = secret.lower()
    for pattern in weak_patterns:
        if pattern in secret_lower:
            return True

    return False


def validate_fernet_key(key: str) -> bool:
    """Validate that a string is a valid Fernet key."""
    try:
        if not key:
            return False

        # Fernet keys must be 32 bytes, base64-encoded (44 chars with padding or 43 without)
        key_bytes = key.encode() if isinstance(key, str) else key
        decoded = base64.urlsafe_b64decode(key_bytes)
        return len(decoded) == 32
    except Exception:
        return False


def constant_time_compare(a: str, b: str) -> bool:
    """Compare two strings in constant time to prevent timing attacks."""
    return secrets.compare_digest(a.encode(), b.encode())
