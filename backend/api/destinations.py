"""
Destinations API - SFTP/FTP delivery endpoints

Manages destination configurations for regulatory report delivery.
Supports SFTP (SSH File Transfer Protocol) and FTP connections.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from database import get_db
from services.auth import get_current_user, encrypt_credentials, decrypt_credentials
from services.delivery import DeliveryService
import models
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

router = APIRouter()


# === Pydantic Models ===

class DestinationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    protocol: str = Field(..., pattern="^(sftp|ftp)$")  # sftp or ftp
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1)
    directory: str = Field(default="/", max_length=500)
    # Retry Policy
    retry_count: int = Field(default=3, ge=1, le=10)
    retry_backoff: str = Field(default="exponential", pattern="^(exponential|linear|fixed)$")
    retry_base_delay: int = Field(default=5, ge=1, le=60, description="Base delay in seconds")
    retry_max_delay: int = Field(default=300, ge=10, le=3600, description="Max delay in seconds")
    description: Optional[str] = None


class DestinationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    host: Optional[str] = Field(None, min_length=1, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    username: Optional[str] = Field(None, min_length=1, max_length=255)
    password: Optional[str] = None  # Only update if provided
    directory: Optional[str] = Field(None, max_length=500)
    # Retry Policy
    retry_count: Optional[int] = Field(None, ge=1, le=10)
    retry_backoff: Optional[str] = Field(None, pattern="^(exponential|linear|fixed)$")
    retry_base_delay: Optional[int] = Field(None, ge=1, le=60)
    retry_max_delay: Optional[int] = Field(None, ge=10, le=3600)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DestinationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    protocol: str
    host: str
    port: int
    username: str
    directory: str
    # Retry Policy
    retry_count: int
    retry_backoff: str = "exponential"
    retry_base_delay: int = 5
    retry_max_delay: int = 300
    description: Optional[str]
    is_active: bool
    last_delivery_at: Optional[datetime] = None
    last_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConnectionTestRequest(BaseModel):
    protocol: str = Field(..., pattern="^(sftp|ftp)$")
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(..., ge=1, le=65535)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    directory: str = Field(default="/")


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str


# === Helper Functions ===

def destination_to_response(destination: models.Destination) -> DestinationResponse:
    """Convert database model to response, extracting config fields."""
    config = destination.config or {}
    retry_policy = destination.retry_policy or {"max_attempts": 3, "backoff": "exponential", "base_delay": 5, "max_delay": 300}
    
    # Get username from encrypted credentials
    username = "****"  # Default masked
    if destination.encrypted_credentials:
        try:
            creds = decrypt_credentials(destination.encrypted_credentials)
            username = creds.get("username", "****")
        except:
            pass
    
    return DestinationResponse(
        id=destination.id,
        tenant_id=destination.tenant_id,
        name=destination.name,
        protocol=destination.protocol.value if destination.protocol else "sftp",
        host=config.get("host", ""),
        port=config.get("port", 22),
        username=username,
        directory=config.get("directory", "/"),
        retry_count=retry_policy.get("max_attempts", 3),
        retry_backoff=retry_policy.get("backoff", "exponential"),
        retry_base_delay=retry_policy.get("base_delay", 5),
        retry_max_delay=retry_policy.get("max_delay", 300),
        description=destination.description,
        is_active=destination.is_active,
        last_delivery_at=config.get("last_delivery_at"),
        last_status=config.get("last_status"),
        created_at=destination.created_at,
        updated_at=destination.updated_at
    )


# === API Endpoints ===

@router.get("", response_model=List[DestinationResponse])
async def list_destinations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all delivery destinations for the current tenant."""
    destinations = db.query(models.Destination).filter(
        models.Destination.tenant_id == current_user.tenant_id
    ).order_by(models.Destination.name).all()
    
    return [destination_to_response(d) for d in destinations]


@router.post("", response_model=DestinationResponse, status_code=201)
async def create_destination(
    data: DestinationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new SFTP/FTP destination.
    
    Credentials (username/password) are encrypted before storage.
    """
    # Encrypt credentials
    encrypted_creds = encrypt_credentials({
        "username": data.username,
        "password": data.password
    })
    
    # Build config object for JSONB storage
    config = {
        "host": data.host,
        "port": data.port,
        "directory": data.directory,
    }
    
    # Build retry policy with all configurable settings
    retry_policy = {
        "max_attempts": data.retry_count,
        "backoff": data.retry_backoff,
        "base_delay": data.retry_base_delay,
        "max_delay": data.retry_max_delay
    }
    
    # Create destination
    destination = models.Destination(
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        protocol=models.DeliveryProtocol(data.protocol),
        config=config,
        encrypted_credentials=encrypted_creds,
        retry_policy=retry_policy,
        is_active=True,
        created_by=current_user.id
    )
    
    db.add(destination)
    db.commit()
    db.refresh(destination)
    
    return destination_to_response(destination)


@router.get("/{destination_id}", response_model=DestinationResponse)
async def get_destination(
    destination_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific destination by ID."""
    destination = db.query(models.Destination).filter(
        models.Destination.id == destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    return destination_to_response(destination)


@router.put("/{destination_id}", response_model=DestinationResponse)
async def update_destination(
    destination_id: UUID,
    data: DestinationUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing destination."""
    destination = db.query(models.Destination).filter(
        models.Destination.id == destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    # Update basic fields
    if data.name is not None:
        destination.name = data.name
    if data.description is not None:
        destination.description = data.description
    if data.is_active is not None:
        destination.is_active = data.is_active
    
    # Update config fields
    config = destination.config or {}
    if data.host is not None:
        config["host"] = data.host
    if data.port is not None:
        config["port"] = data.port
    if data.directory is not None:
        config["directory"] = data.directory
    destination.config = config
    
    # Update retry policy
    retry_policy = destination.retry_policy or {"max_attempts": 3, "backoff": "exponential", "base_delay": 5, "max_delay": 300}
    if data.retry_count is not None:
        retry_policy["max_attempts"] = data.retry_count
    if data.retry_backoff is not None:
        retry_policy["backoff"] = data.retry_backoff
    if data.retry_base_delay is not None:
        retry_policy["base_delay"] = data.retry_base_delay
    if data.retry_max_delay is not None:
        retry_policy["max_delay"] = data.retry_max_delay
    destination.retry_policy = retry_policy
    
    # Update credentials if password provided
    if data.password is not None:
        # Get existing username or use new one
        username = data.username
        if username is None and destination.encrypted_credentials:
            try:
                existing_creds = decrypt_credentials(destination.encrypted_credentials)
                username = existing_creds.get("username", "")
            except:
                username = ""
        
        if username:
            destination.encrypted_credentials = encrypt_credentials({
                "username": username,
                "password": data.password
            })
    elif data.username is not None:
        # Update only username, keep existing password
        if destination.encrypted_credentials:
            try:
                existing_creds = decrypt_credentials(destination.encrypted_credentials)
                destination.encrypted_credentials = encrypt_credentials({
                    "username": data.username,
                    "password": existing_creds.get("password", "")
                })
            except:
                pass
    
    destination.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(destination)
    
    return destination_to_response(destination)


@router.delete("/{destination_id}", status_code=204)
async def delete_destination(
    destination_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a destination."""
    destination = db.query(models.Destination).filter(
        models.Destination.id == destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    db.delete(destination)
    db.commit()
    
    return None


@router.post("/test", response_model=ConnectionTestResponse)
async def test_connection(
    data: ConnectionTestRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Test an SFTP or FTP connection.
    
    This performs a REAL network connection to the specified host:
    - Opens a TCP socket to the remote server
    - Authenticates with provided credentials
    - Verifies the directory is accessible
    
    Use this before creating a destination to ensure connectivity.
    """
    if data.protocol == "sftp":
        result = DeliveryService.test_sftp_connection(
            host=data.host,
            port=data.port,
            username=data.username,
            password=data.password,
            directory=data.directory
        )
    else:  # ftp
        result = DeliveryService.test_ftp_connection(
            host=data.host,
            port=data.port,
            username=data.username,
            password=data.password,
            directory=data.directory
        )
    
    return ConnectionTestResponse(**result)


@router.post("/{destination_id}/test", response_model=ConnectionTestResponse)
async def test_existing_destination(
    destination_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Test connection for an existing destination.
    
    Uses the stored credentials to verify the connection is still working.
    """
    destination = db.query(models.Destination).filter(
        models.Destination.id == destination_id,
        models.Destination.tenant_id == current_user.tenant_id
    ).first()
    
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    # Decrypt credentials
    if not destination.encrypted_credentials:
        raise HTTPException(status_code=400, detail="No credentials stored for this destination")
    
    try:
        creds = decrypt_credentials(destination.encrypted_credentials)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to decrypt credentials")
    
    config = destination.config or {}
    
    if destination.protocol == models.DeliveryProtocol.SFTP:
        result = DeliveryService.test_sftp_connection(
            host=config.get("host", ""),
            port=config.get("port", 22),
            username=creds.get("username", ""),
            password=creds.get("password", ""),
            directory=config.get("directory", "/")
        )
    else:  # FTP
        result = DeliveryService.test_ftp_connection(
            host=config.get("host", ""),
            port=config.get("port", 21),
            username=creds.get("username", ""),
            password=creds.get("password", ""),
            directory=config.get("directory", "/")
        )
    
    # Update last test status in config
    config["last_test_at"] = datetime.now(timezone.utc).isoformat()
    config["last_test_status"] = "success" if result["success"] else "failed"
    destination.config = config
    db.commit()
    
    return ConnectionTestResponse(**result)
