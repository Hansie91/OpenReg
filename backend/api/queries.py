"""
Query Execution API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID

from database import get_db
from services.auth import get_current_user, decrypt_credentials
from services.database import DatabaseService, DatabaseQueryError, DatabaseTimeoutError
import models

router = APIRouter()


class QueryExecuteRequest(BaseModel):
    """Request body for executing a query"""
    connector_id: UUID
    query: str
    parameters: Optional[List[Any]] = None
    timeout: Optional[int] = None


class QueryExecuteResponse(BaseModel):
    """Response for query execution"""
    success: bool
    row_count: int
    data: List[Dict[str, Any]]
    execution_time_ms: float
    message: Optional[str] = None


@router.post("/execute", response_model=QueryExecuteResponse)
async def execute_query(
    request: QueryExecuteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute a SQL query using a saved connector.
    Useful for testing queries before creating reports.
    """
    import time
    
    # Get connector
    connector = db.query(models.Connector).filter(
        models.Connector.id == request.connector_id,
        models.Connector.tenant_id == current_user.tenant_id,
        models.Connector.is_active == True
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found or inactive")
    
    try:
        # Decrypt credentials
        credentials = decrypt_credentials(connector.encrypted_credentials)
        
        # Execute query
        start_time = time.time()
        results = DatabaseService.execute_query(
            db_type=connector.type.value,
            config=connector.config,
            credentials=credentials,
            query=request.query,
            params=tuple(request.parameters) if request.parameters else None,
            timeout=request.timeout or 300
        )
        execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        return QueryExecuteResponse(
            success=True,
            row_count=len(results),
            data=results,
            execution_time_ms=execution_time,
            message="Query executed successfully"
        )
        
    except DatabaseTimeoutError as e:
        raise HTTPException(status_code=408, detail=f"Query timeout: {str(e)}")
    except DatabaseQueryError as e:
        raise HTTPException(status_code=400, detail=f"Query error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")


@router.post("/validate")
async def validate_query(
    request: QueryExecuteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate a SQL query without executing it (uses EXPLAIN or similar).
    """
    # Get connector
    connector = db.query(models.Connector).filter(
        models.Connector.id == request.connector_id,
        models.Connector.tenant_id == current_user.tenant_id,
        models.Connector.is_active == True
    ).first()
    
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found or inactive")
    
    try:
        # Decrypt credentials
        credentials = decrypt_credentials(connector.encrypted_credentials)
        
        # Prepend EXPLAIN to validate query syntax
        validation_query = f"EXPLAIN {request.query}"
        
        DatabaseService.execute_query(
            db_type=connector.type.value,
            config=connector.config,
            credentials=credentials,
            query=validation_query,
            timeout=10  # Short timeout for validation
        )
        
        return {
            "valid": True,
            "message": "Query syntax is valid"
        }
        
    except DatabaseQueryError as e:
        return {
            "valid": False,
            "message": f"Query validation failed: {str(e)}"
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Validation error: {str(e)}"
        }
