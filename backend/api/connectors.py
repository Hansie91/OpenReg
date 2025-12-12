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
from services.auth import get_current_user, encrypt_credentials, decrypt_credentials, log_audit
from services.database import DatabaseService, DatabaseConnectionError
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


class ConnectorTestRequest(BaseModel):
    """Request body for testing connection before saving"""
    type: str
    config: dict
    credentials: dict


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


@router.put("/{connector_id}", response_model=ConnectorResponse)
async def update_connector(
    connector_id: UUID,
    update: ConnectorUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing connector"""
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    # Update fields if provided
    if update.name is not None:
        connector.name = update.name
    if update.description is not None:
        connector.description = update.description
    if update.config is not None:
        connector.config = update.config
    if update.credentials is not None:
        connector.encrypted_credentials = encrypt_credentials(update.credentials)
    if update.is_active is not None:
        connector.is_active = update.is_active
    
    db.commit()
    db.refresh(connector)
    
    log_audit(db, current_user, models.AuditAction.UPDATE, "Connector", str(connector.id))
    
    return connector


@router.delete("/{connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connector(
    connector_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a connector"""
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    # Check if connector is used by any reports
    report_count = db.query(models.ReportVersion).filter(
        models.ReportVersion.connector_id == connector_id
    ).count()
    
    if report_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete connector: it is used by {report_count} report(s)"
        )
    
    log_audit(db, current_user, models.AuditAction.DELETE, "Connector", str(connector.id))
    
    db.delete(connector)
    db.commit()
    
    return None


@router.post("/test")
async def test_connection(
    request: ConnectorTestRequest,
    current_user: models.User = Depends(get_current_user)
):
    """Test database connection before saving (no connector ID required)"""
    try:
        result = DatabaseService.test_connection(
            db_type=request.type,
            config=request.config,
            credentials=request.credentials
        )
        return result
    except DatabaseConnectionError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Connection test failed: {str(e)}"}


@router.post("/{connector_id}/test")
async def test_existing_connector(
    connector_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test connection for an existing saved connector"""
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    try:
        # Decrypt credentials
        credentials = decrypt_credentials(connector.encrypted_credentials)
        
        result = DatabaseService.test_connection(
            db_type=connector.type.value,
            config=connector.config,
            credentials=credentials
        )
        return result
    except DatabaseConnectionError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Connection test failed: {str(e)}"}


@router.get("/{connector_id}/tables")
async def list_connector_tables(
    connector_id: UUID,
    schema_name: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all tables available from a connector.
    
    Args:
        connector_id: ID of the connector
        schema_name: Optional schema filter (e.g., 'public', 'dbo')
    
    Returns:
        List of tables with schema and name
    """
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    try:
        credentials = decrypt_credentials(connector.encrypted_credentials)
        
        # Get tables using the appropriate query for the database type
        tables = DatabaseService.get_tables(
            db_type=connector.type.value,
            config=connector.config,
            credentials=credentials,
            schema_filter=schema_name
        )
        
        return {"tables": tables}
    except DatabaseConnectionError as e:
        raise HTTPException(status_code=400, detail=f"Connection error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list tables: {str(e)}")


@router.get("/{connector_id}/columns")
async def list_table_columns(
    connector_id: UUID,
    table: str,
    schema_name: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all columns for a specific table.
    
    Args:
        connector_id: ID of the connector
        table: Name of the table
        schema_name: Optional schema name
    
    Returns:
        List of columns with name, type, nullable, etc.
    """
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    try:
        credentials = decrypt_credentials(connector.encrypted_credentials)
        
        # Get columns for the specified table
        columns = DatabaseService.get_columns(
            db_type=connector.type.value,
            config=connector.config,
            credentials=credentials,
            table_name=table,
            schema_name=schema_name
        )
        
        return {"columns": columns}
    except DatabaseConnectionError as e:
        raise HTTPException(status_code=400, detail=f"Connection error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list columns: {str(e)}")


@router.get("/{connector_id}/preview")
async def preview_table_data(
    connector_id: UUID,
    table: str,
    schema_name: Optional[str] = None,
    limit: int = 10,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Preview data from a table (first N rows).
    
    Args:
        connector_id: ID of the connector
        table: Name of the table
        schema_name: Optional schema name
        limit: Maximum rows to return (default 10, max 100)
    
    Returns:
        Sample rows from the table
    """
    if limit > 100:
        limit = 100
    
    connector = db.query(models.Connector).filter(
        models.Connector.id == connector_id,
        models.Connector.tenant_id == current_user.tenant_id
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    try:
        credentials = decrypt_credentials(connector.encrypted_credentials)
        
        # Get preview data
        rows = DatabaseService.preview_table(
            db_type=connector.type.value,
            config=connector.config,
            credentials=credentials,
            table_name=table,
            schema_name=schema_name,
            limit=limit
        )
        
        return {"rows": rows, "table": table, "row_count": len(rows)}
    except DatabaseConnectionError as e:
        raise HTTPException(status_code=400, detail=f"Connection error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview data: {str(e)}")

