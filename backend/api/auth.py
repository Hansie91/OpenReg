"""
Authentication API endpoints

Enhanced with:
- Server-side token registration and revocation
- Token rotation on refresh
- Logout all sessions capability
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from database import get_db
from services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
    decode_token_unsafe,
    get_current_user,
    hash_password
)
from services.token_store import token_store
import models

router = APIRouter()
security = HTTPBearer()


# === Pydantic Schemas ===

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Access token expiry in seconds
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    tenant_id: str
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Convert UUID fields to strings
        if hasattr(obj, 'id'):
            obj_dict = {
                'id': str(obj.id),
                'email': obj.email,
                'full_name': obj.full_name,
                'tenant_id': str(obj.tenant_id),
                'is_active': obj.is_active,
                'is_superuser': obj.is_superuser,
                'created_at': obj.created_at,
            }
            return super().model_validate(obj_dict, **kwargs)
        return super().model_validate(obj, **kwargs)


# === Endpoints ===

@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT tokens.

    Tokens include enhanced security claims (iss, aud, jti) and are
    registered in the token store for server-side revocation support.
    """
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create tokens with enhanced claims
    token_data = {"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    access_token, access_jti, access_expires = create_access_token(token_data)
    refresh_token, refresh_jti, refresh_expires = create_refresh_token(token_data)

    # Register tokens in store for revocation support
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    token_store.register_token(
        user_id=str(user.id),
        jti=access_jti,
        token_type="access",
        expires_at=access_expires,
        metadata={"ip": client_ip, "user_agent": user_agent}
    )
    token_store.register_token(
        user_id=str(user.id),
        jti=refresh_jti,
        token_type="refresh",
        expires_at=refresh_expires,
        metadata={"ip": client_ip, "user_agent": user_agent}
    )

    # Calculate expires_in for frontend
    from config import settings
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "tenant_id": str(user.tenant_id),
            "is_superuser": user.is_superuser
        }
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(
    request_body: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.

    Implements token rotation:
    - Validates the refresh token
    - Revokes the old refresh token
    - Issues new access and refresh tokens
    """
    try:
        # Decode and validate refresh token
        payload = decode_token(request_body.refresh_token, expected_type="refresh")

        user_id = payload.get("sub")
        old_jti = payload.get("jti")

        # Check if refresh token has been revoked
        if old_jti and not token_store.is_token_valid(user_id, old_jti, "refresh"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked"
            )

        user = db.query(models.User).filter(models.User.id == user_id).first()

        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        # Revoke old refresh token (token rotation)
        if old_jti:
            token_store.revoke_token(user_id, old_jti, "refresh")

        # Create new tokens
        token_data = {"sub": str(user.id), "tenant_id": str(user.tenant_id)}
        new_access_token, access_jti, access_expires = create_access_token(token_data)
        new_refresh_token, refresh_jti, refresh_expires = create_refresh_token(token_data)

        # Register new tokens
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        token_store.register_token(
            user_id=str(user.id),
            jti=access_jti,
            token_type="access",
            expires_at=access_expires,
            metadata={"ip": client_ip, "user_agent": user_agent}
        )
        token_store.register_token(
            user_id=str(user.id),
            jti=refresh_jti,
            token_type="refresh",
            expires_at=refresh_expires,
            metadata={"ip": client_ip, "user_agent": user_agent}
        )

        from config import settings
        expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": expires_in,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tenant_id": str(user.tenant_id),
                "is_superuser": user.is_superuser
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: models.User = Depends(get_current_user)
):
    """Get current authenticated user information"""
    return current_user


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: models.User = Depends(get_current_user)
):
    """
    Logout the current session by revoking the access token.

    The client should also discard the refresh token.
    For full logout (all sessions), use /logout-all.
    """
    # Extract and revoke the current access token
    token = credentials.credentials
    payload = decode_token_unsafe(token)

    if payload:
        user_id = payload.get("sub")
        jti = payload.get("jti")
        if user_id and jti:
            token_store.revoke_token(user_id, jti, "access")

    return {"message": "Successfully logged out"}


@router.post("/logout-all")
async def logout_all_sessions(
    current_user: models.User = Depends(get_current_user)
):
    """
    Logout from all sessions by revoking all tokens for the user.

    This will invalidate all access and refresh tokens across all devices.
    """
    count = token_store.revoke_all_user_tokens(str(current_user.id))
    return {
        "message": "Successfully logged out from all sessions",
        "sessions_revoked": count
    }


@router.get("/sessions")
async def get_active_sessions(
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all active sessions (refresh tokens) for the current user.

    Useful for showing users where they're logged in.
    """
    sessions = token_store.get_user_sessions(str(current_user.id))
    return {
        "sessions": sessions,
        "count": len(sessions)
    }
