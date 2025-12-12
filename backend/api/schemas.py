"""
Schema API - XSD Schema Management

Endpoints for uploading, parsing, and managing XSD schemas
for declarative report generation.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user
from services.schema_service import parse_xsd, validate_xml_against_xsd, get_xsd_info
import models

router = APIRouter(tags=["schemas"])


# === Request/Response Models ===

class SchemaCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    version: Optional[str] = None
    xsd_content: str


class SchemaResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    version: Optional[str]
    root_element: Optional[str]
    namespace: Optional[str]
    element_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SchemaDetailResponse(SchemaResponse):
    """Extended response with parsed elements"""
    parsed_elements: Optional[Dict[str, Any]]
    xsd_content: str


class SchemaListResponse(BaseModel):
    total: int
    schemas: List[SchemaResponse]


class ValidateXMLRequest(BaseModel):
    xml_content: str


class ValidationResultResponse(BaseModel):
    is_valid: bool
    errors: List[str]


# === API Endpoints ===

@router.get("", response_model=SchemaListResponse)
async def list_schemas(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all XSD schemas for the current tenant"""
    query = db.query(models.ReportSchema).filter(
        models.ReportSchema.tenant_id == current_user.tenant_id,
        models.ReportSchema.is_active == True
    )
    
    total = query.count()
    schemas = query.order_by(models.ReportSchema.created_at.desc()).offset(skip).limit(limit).all()
    
    schema_responses = []
    for schema in schemas:
        element_count = 0
        if schema.parsed_elements and 'flat_elements' in schema.parsed_elements:
            element_count = len(schema.parsed_elements['flat_elements'])
        
        schema_responses.append(SchemaResponse(
            id=schema.id,
            name=schema.name,
            description=schema.description,
            version=schema.version,
            root_element=schema.root_element,
            namespace=schema.namespace,
            element_count=element_count,
            is_active=schema.is_active,
            created_at=schema.created_at
        ))
    
    return SchemaListResponse(total=total, schemas=schema_responses)


@router.post("", response_model=SchemaResponse)
async def create_schema(
    request: SchemaCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new XSD schema from content"""
    # Validate and parse the XSD
    try:
        info = get_xsd_info(request.xsd_content)
        if not info.get('valid', False):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid XSD: {info.get('error', 'Unknown error')}"
            )
        
        parsed = parse_xsd(request.xsd_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse XSD: {str(e)}")
    
    # Create schema record
    schema = models.ReportSchema(
        tenant_id=current_user.tenant_id,
        name=request.name,
        description=request.description,
        version=request.version,
        xsd_content=request.xsd_content,
        parsed_elements=parsed,
        root_element=parsed.get('root_element'),
        namespace=parsed.get('namespace'),
        created_by=current_user.id
    )
    
    db.add(schema)
    db.commit()
    db.refresh(schema)
    
    element_count = len(parsed.get('flat_elements', []))
    
    return SchemaResponse(
        id=schema.id,
        name=schema.name,
        description=schema.description,
        version=schema.version,
        root_element=schema.root_element,
        namespace=schema.namespace,
        element_count=element_count,
        is_active=schema.is_active,
        created_at=schema.created_at
    )


@router.post("/upload", response_model=SchemaResponse)
async def upload_schema(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload an XSD schema file"""
    if not file.filename.endswith('.xsd'):
        raise HTTPException(status_code=400, detail="File must have .xsd extension")
    
    content = await file.read()
    xsd_content = content.decode('utf-8')
    
    # Use the create logic
    request = SchemaCreateRequest(
        name=name,
        description=description,
        version=version,
        xsd_content=xsd_content
    )
    
    return await create_schema(request, current_user, db)


@router.get("/{schema_id}", response_model=SchemaDetailResponse)
async def get_schema(
    schema_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get schema details including parsed elements"""
    schema = db.query(models.ReportSchema).filter(
        models.ReportSchema.id == schema_id,
        models.ReportSchema.tenant_id == current_user.tenant_id
    ).first()
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    element_count = 0
    if schema.parsed_elements and 'flat_elements' in schema.parsed_elements:
        element_count = len(schema.parsed_elements['flat_elements'])
    
    return SchemaDetailResponse(
        id=schema.id,
        name=schema.name,
        description=schema.description,
        version=schema.version,
        root_element=schema.root_element,
        namespace=schema.namespace,
        element_count=element_count,
        is_active=schema.is_active,
        created_at=schema.created_at,
        parsed_elements=schema.parsed_elements,
        xsd_content=schema.xsd_content
    )


@router.get("/{schema_id}/elements")
async def get_schema_elements(
    schema_id: UUID,
    flat: bool = True,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get parsed elements from a schema (flat or hierarchical)"""
    schema = db.query(models.ReportSchema).filter(
        models.ReportSchema.id == schema_id,
        models.ReportSchema.tenant_id == current_user.tenant_id
    ).first()
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    if not schema.parsed_elements:
        raise HTTPException(status_code=400, detail="Schema has not been parsed")
    
    if flat:
        return {"elements": schema.parsed_elements.get('flat_elements', [])}
    else:
        return {"elements": schema.parsed_elements.get('elements', [])}


@router.delete("/{schema_id}")
async def delete_schema(
    schema_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a schema (soft delete)"""
    schema = db.query(models.ReportSchema).filter(
        models.ReportSchema.id == schema_id,
        models.ReportSchema.tenant_id == current_user.tenant_id
    ).first()
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    # TODO: Check if schema is in use by any reports
    
    schema.is_active = False
    db.commit()
    
    return {"message": "Schema deleted successfully"}


@router.post("/{schema_id}/validate", response_model=ValidationResultResponse)
async def validate_xml(
    schema_id: UUID,
    request: ValidateXMLRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate XML content against a schema"""
    schema = db.query(models.ReportSchema).filter(
        models.ReportSchema.id == schema_id,
        models.ReportSchema.tenant_id == current_user.tenant_id
    ).first()
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    is_valid, errors = validate_xml_against_xsd(request.xml_content, schema.xsd_content)
    
    return ValidationResultResponse(is_valid=is_valid, errors=errors)


@router.post("/parse-preview")
async def parse_preview(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Preview parsing of an XSD file without saving.
    Useful for checking schema structure before upload.
    """
    if not file.filename.endswith('.xsd'):
        raise HTTPException(status_code=400, detail="File must have .xsd extension")
    
    content = await file.read()
    xsd_content = content.decode('utf-8')
    
    try:
        info = get_xsd_info(xsd_content)
        if not info.get('valid', False):
            return {
                "valid": False,
                "error": info.get('error', 'Unknown error')
            }
        
        parsed = parse_xsd(xsd_content)
        
        return {
            "valid": True,
            "root_element": parsed.get('root_element'),
            "namespace": parsed.get('namespace'),
            "element_count": len(parsed.get('flat_elements', [])),
            "elements_preview": parsed.get('flat_elements', [])[:20]  # First 20 for preview
        }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e)
        }
