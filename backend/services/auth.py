"""
Authentication and authorization service

Handles JWT token creation, password hashing, and RBAC checks.
Enhanced with:
- iss (issuer), aud (audience), jti (JWT ID) claims for security
- Token type validation
- Support for server-side token revocation
"""

from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Union
from jose import JWTError, jwt, ExpiredSignatureError
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet, InvalidToken
import secrets

from config import settings
from database import get_db
from core.security import generate_jti, hash_api_key
from core.exceptions import TokenExpiredError, TokenRevokedError, TokenInvalidError
import models

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token
security = HTTPBearer(auto_error=False)

# API Key header
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Encryption for credentials (Fernet symmetric encryption)
def get_cipher():
    """Get Fernet cipher for encrypting/decrypting credentials"""
    # In production, ENCRYPTION_KEY should be a proper Fernet key
    key = settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY
    # Ensure it's a valid Fernet key (base64-encoded 32 bytes)
    if len(key) != 44:  # Base64-encoded 32 bytes = 44 chars
        # For dev/demo, generate a temporary key (NOT for production!)
        key = Fernet.generate_key()
    return Fernet(key)


# === Password Hashing ===

def hash_password(password: str) -> str:
    """Hash a plaintext password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


# === JWT Token Management ===

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> Tuple[str, str, datetime]:
    """
    Create a JWT access token with enhanced security claims.

    Args:
        data: Token payload data (must include 'sub' for user ID)
        expires_delta: Optional custom expiration time

    Returns:
        Tuple of (token, jti, expires_at) for tracking purposes
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = generate_jti()

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
        "jti": jti,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt, jti, expire


def create_refresh_token(data: dict) -> Tuple[str, str, datetime]:
    """
    Create a JWT refresh token with enhanced security claims.

    Args:
        data: Token payload data (must include 'sub' for user ID)

    Returns:
        Tuple of (token, jti, expires_at) for tracking purposes
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    jti = generate_jti()

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
        "jti": jti,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt, jti, expire


def decode_token(token: str, expected_type: str = None) -> dict:
    """
    Decode and verify a JWT token with claim validation.

    Args:
        token: The JWT token string
        expected_type: Optional expected token type ('access' or 'refresh')

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token is invalid, expired, or wrong type
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER
        )

        # Validate token type if specified
        if expected_type and payload.get("type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {expected_type}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_token_unsafe(token: str) -> Optional[dict]:
    """
    Decode a token without validation. Used for extracting claims from expired tokens.
    DO NOT use for authentication - only for extracting user ID for revocation.
    """
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False, "verify_aud": False, "verify_iss": False}
        )
    except JWTError:
        return None


# === User Authentication ===

def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    """Authenticate a user by email and password"""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


# === Current User Dependency ===

class AuthenticatedEntity:
    """
    Wrapper for authenticated entity - can be either a User (JWT) or APIKey.
    Provides a unified interface for permission checking.
    """
    def __init__(
        self,
        user: Optional[models.User] = None,
        api_key: Optional[models.APIKey] = None
    ):
        self.user = user
        self.api_key = api_key
        self._is_api_key = api_key is not None

    @property
    def is_api_key_auth(self) -> bool:
        return self._is_api_key

    @property
    def tenant_id(self):
        if self.user:
            return self.user.tenant_id
        if self.api_key:
            return self.api_key.tenant_id
        return None

    @property
    def permissions(self) -> List[str]:
        if self.api_key:
            return self.api_key.permissions or []
        if self.user:
            # Get permissions from user roles
            perms = set()
            if self.user.is_superuser:
                return ["*:*"]
            for user_role in self.user.roles:
                role = user_role.role
                if role and role.permissions:
                    perms.update(role.permissions)
            return list(perms)
        return []


async def validate_api_key(
    api_key_value: str,
    db: Session,
    client_ip: Optional[str] = None
) -> Optional[models.APIKey]:
    """
    Validate an API key from request header.

    Returns the APIKey model if valid, None otherwise.
    """
    if not api_key_value or not api_key_value.startswith("openreg_"):
        return None

    # Hash the key and look up
    key_hash = hash_api_key(api_key_value)

    api_key = db.query(models.APIKey).filter(
        models.APIKey.key_hash == key_hash,
        models.APIKey.is_active == True
    ).first()

    if not api_key:
        return None

    # Check expiration
    if api_key.expires_at and api_key.expires_at < datetime.utcnow():
        return None

    # Check IP whitelist
    if api_key.allowed_ips and len(api_key.allowed_ips) > 0:
        if client_ip and client_ip not in api_key.allowed_ips:
            return None

    # Update usage stats
    api_key.last_used_at = datetime.utcnow()
    api_key.use_count = (api_key.use_count or 0) + 1
    db.commit()

    return api_key


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    api_key_value: Optional[str] = Depends(api_key_header),
    db: Session = Depends(get_db),
    request: Request = None
) -> models.User:
    """
    Dependency to get the current authenticated user.
    Supports both JWT Bearer tokens and API keys.

    Use in FastAPI routes: current_user: models.User = Depends(get_current_user)

    Authentication methods (in order of precedence):
    1. Authorization: Bearer <token> header (JWT)
    2. X-API-Key: <key> header (API key)

    Validates:
    - Token is a valid access token (not refresh token) for JWT
    - API key is valid and not expired for API key auth
    - User/tenant exists and is active
    """
    # Get client IP for API key validation
    client_ip = None
    if request and request.client:
        client_ip = request.client.host

    # Try JWT auth first
    if credentials and credentials.credentials:
        token = credentials.credentials
        payload = decode_token(token, expected_type="access")

        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )

        # Check if token has been revoked (if token store is available)
        jti = payload.get("jti")
        if jti:
            try:
                from services.token_store import token_store
                if token_store and not token_store.is_token_valid_sync(user_id, jti, "access"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token has been revoked",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except ImportError:
                # Token store not available, skip revocation check
                pass

        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        return user

    # Try API key auth
    if api_key_value:
        api_key = await validate_api_key(api_key_value, db, client_ip)
        if api_key:
            # For API key auth, we need to return a user-like object
            # Get the creator of the API key as the "user"
            user = db.query(models.User).filter(
                models.User.id == api_key.created_by
            ).first()

            if user and user.is_active:
                # Attach API key info to user for permission checking
                user._api_key = api_key
                user._api_key_permissions = api_key.permissions
                return user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
            headers={"WWW-Authenticate": "X-API-Key"},
        )

    # No authentication provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_or_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    api_key_value: Optional[str] = Depends(api_key_header),
    db: Session = Depends(get_db),
    request: Request = None
) -> AuthenticatedEntity:
    """
    Dependency that returns an AuthenticatedEntity wrapper.
    Use when you need to distinguish between user and API key authentication.
    """
    client_ip = None
    if request and request.client:
        client_ip = request.client.host

    # Try JWT auth first
    if credentials and credentials.credentials:
        user = await get_current_user(credentials, None, db, request)
        return AuthenticatedEntity(user=user)

    # Try API key auth
    if api_key_value:
        api_key = await validate_api_key(api_key_value, db, client_ip)
        if api_key:
            return AuthenticatedEntity(api_key=api_key)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


# === RBAC - Permission Checking ===

def get_user_permissions(db: Session, user: models.User) -> List[str]:
    """Get all permissions for a user based on their roles"""
    permissions = set()
    
    # Superusers have all permissions
    if user.is_superuser:
        return ["*"]
    
    # Aggregate permissions from all roles
    for user_role in user.roles:
        role = user_role.role
        if role.permissions:
            permissions.update(role.permissions)
    
    return list(permissions)


def has_permission(user: models.User, db: Session, permission: str) -> bool:
    """Check if a user has a specific permission"""
    user_permissions = get_user_permissions(db, user)
    
    # Superuser or wildcard permission
    if "*" in user_permissions:
        return True
    
    # Exact permission match
    if permission in user_permissions:
        return True
    
    # Check for wildcard patterns (e.g., "report:*" matches "report:create")
    permission_parts = permission.split(":")
    if len(permission_parts) == 2:
        wildcard = f"{permission_parts[0]}:*"
        if wildcard in user_permissions:
            return True
    
    return False


def require_permission(permission: str):
    """
    Decorator factory for permission-based access control.
    Usage:
        @router.get("/reports")
        @require_permission("report:read")
        async def list_reports(...):
    """
    def permission_checker(
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        if not has_permission(current_user, db, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission} required"
            )
        return current_user
    
    return permission_checker


async def require_admin(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    """
    Dependency to require admin (superuser) access.
    Use in FastAPI routes: current_user = Depends(require_admin)
    Raises 403 Forbidden if user is not an admin.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required"
        )
    return current_user


# === Credential Encryption ===

def encrypt_credentials(credentials_dict: dict) -> bytes:
    """Encrypt credentials dictionary for storage"""
    import json
    cipher = get_cipher()
    credentials_json = json.dumps(credentials_dict)
    return cipher.encrypt(credentials_json.encode())


def decrypt_credentials(encrypted_credentials: bytes) -> dict:
    """Decrypt stored credentials"""
    import json
    cipher = get_cipher()
    try:
        decrypted = cipher.decrypt(encrypted_credentials)
        return json.loads(decrypted.decode())
    except InvalidToken:
        raise ValueError("Invalid encryption token. The secret key may have changed.")


# === Audit Logging ===

def log_audit(
    db: Session,
    user: models.User,
    action: models.AuditAction,
    entity_type: str,
    entity_id: Optional[str] = None,
    changes: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Create an audit log entry"""
    audit_log = models.AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(audit_log)
    db.commit()
