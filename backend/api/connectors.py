"""
Connectors API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user, encrypt_credentials, log_audit
import models

router = APIRouter()


class ConnectorCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # postgresql, sqlserver, oracle, mysql, odbc
    config: dict  # {host, port, database, etc.}
    credentials: dict  # {username, password}


class ConnectorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict] = None
    credentials: Optional[dict] = None
    is_active: Optional[bool] = None


class ConnectorResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    type: str
    config: dict
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[ConnectorResponse])
async def list_connectors(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all connectors for the current tenant"""
    connectors = db.query(models.Connector).filter(
        models.Connector.tenant_id == current_user.tenant_id
    ).all()
    return connectors


@router.post("", response_model=ConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_connector(
    connector: ConnectorCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new database connector"""
    # Encrypt credentials
    encrypted_creds = encrypt_credentials(connector.credentials)
    
    db_connector = models.Connector(
        tenant_id=current_user.tenant_id,
        name=connector.name,
        description=connector.description,
        type=models.ConnectorType(connector.type),
        config=connector.config,
        encrypted_credentials=encrypted_creds,
        created_by=current_user.id
    )
    db.add(db_connector)
    db.commit()
    db.refresh(db_connector)
    
    log_audit(db, current_user, models.AuditAction.CREATE, "Connector", str(db_connector.id))
    
    return db_connector


@router.get("/{connector_id}", response_model=ConnectorResponse)
async def get_connector(
    connector_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific connector"""
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    return connector


@router.post("/{connector_id}/test")
async def test_connector(
    connector_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test connector connection"""
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    # TODO: Implement actual connection test using plugins
    # For MVP, return success
    return {"status": "success", "message": "Connection test successful (stub)"}


# TODO: Implement PUT /{connector_id} and DELETE /{connector_id}
