"""
Authentication and authorization service

Handles JWT token creation, password hashing, and RBAC checks.
"""

from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet

from config import settings
from database import get_db
import models

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token
security = HTTPBearer()

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

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


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

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Dependency to get the current authenticated user.
    Use in FastAPI routes: current_user: models.User = Depends(get_current_user)
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    return user


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
    decrypted = cipher.decrypt(encrypted_credentials)
    return json.loads(decrypted.decode())


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
