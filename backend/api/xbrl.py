"""
XBRL Taxonomy API

Endpoints for uploading, managing, and querying XBRL taxonomies.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from database import get_db
from services.auth import get_current_user, log_audit
from services.xbrl_parser import parse_xbrl_taxonomy, ParsedTaxonomy
import models

router = APIRouter()


# === Pydantic Schemas ===

class XBRLTaxonomyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    version: Optional[str] = None


class XBRLTaxonomyResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    version: Optional[str]
    namespace: str
    entry_point_uri: Optional[str]
    concept_count: int
    dimension_count: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConceptResponse(BaseModel):
    name: str
    id: str
    element_type: str
    period_type: Optional[str]
    balance: Optional[str]
    abstract: bool
    nillable: bool
    label: Optional[str] = None  # Populated from label linkbase
    documentation: Optional[str] = None


class DimensionResponse(BaseModel):
    name: str
    id: str
    dimension_type: str
    domain: Optional[str]
    members: List[str]
    default_member: Optional[str]


class PresentationTreeNode(BaseModel):
    concept: str
    label: Optional[str]
    order: float
    children: List['PresentationTreeNode'] = []


# === Endpoints ===

@router.post("/upload", response_model=XBRLTaxonomyResponse, status_code=status.HTTP_201_CREATED)
async def upload_xbrl_taxonomy(
    file: UploadFile = File(...),
    name: str = None,
    description: str = None,
    version: str = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an XBRL taxonomy package (ZIP file).
    
    The ZIP should contain:
    - Entry point XSD (schema definition)
    - Linkbase files (presentation, calculation, definition, label, reference)
    
    The taxonomy will be parsed and its structure stored for use in report mapping.
    """
    if not file.filename.endswith('.zip'):
        raise HTTPException(
            status_code=400,
            detail="File must be a ZIP archive containing the taxonomy"
        )
    
    # Read file content
    content = await file.read()
    
    try:
        # Parse the taxonomy
        parsed = parse_xbrl_taxonomy(content)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse XBRL taxonomy: {str(e)}"
        )
    
    # Use provided name or derive from file
    taxonomy_name = name or file.filename.replace('.zip', '')
    
    # Create database record
    taxonomy = models.XBRLTaxonomy(
        tenant_id=current_user.tenant_id,
        name=taxonomy_name,
        description=description,
        version=version,
        namespace=parsed.namespace,
        entry_point_uri=parsed.entry_point_uri,
        concepts=[c.__dict__ for c in parsed.concepts],
        dimensions=[d.__dict__ for d in parsed.dimensions],
        presentation_linkbase=parsed.presentation_linkbase,
        calculation_linkbase=parsed.calculation_linkbase,
        definition_linkbase=parsed.definition_linkbase,
        label_linkbase=parsed.label_linkbase,
        reference_linkbase=parsed.reference_linkbase,
        raw_files=parsed.raw_files,
        created_by=current_user.id
    )
    
    db.add(taxonomy)
    db.commit()
    db.refresh(taxonomy)
    
    # Audit log
    log_audit(db, current_user, models.AuditAction.CREATE, "XBRLTaxonomy", str(taxonomy.id))
    
    return {
        **taxonomy.__dict__,
        'concept_count': len(parsed.concepts),
        'dimension_count': len(parsed.dimensions)
    }


@router.get("", response_model=List[XBRLTaxonomyResponse])
async def list_xbrl_taxonomies(
    skip: int = 0,
    limit: int = 100,
    is_active: bool = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all XBRL taxonomies for the current tenant"""
    query = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        query = query.filter(models.XBRLTaxonomy.is_active == is_active)
    
    taxonomies = query.offset(skip).limit(limit).all()
    
    results = []
    for tax in taxonomies:
        results.append({
            'id': tax.id,
            'tenant_id': tax.tenant_id,
            'name': tax.name,
            'description': tax.description,
            'version': tax.version,
            'namespace': tax.namespace,
            'entry_point_uri': tax.entry_point_uri,
            'concept_count': len(tax.concepts) if tax.concepts else 0,
            'dimension_count': len(tax.dimensions) if tax.dimensions else 0,
            'is_active': tax.is_active,
            'created_at': tax.created_at
        })
    
    return results


@router.get("/{taxonomy_id}", response_model=XBRLTaxonomyResponse)
async def get_xbrl_taxonomy(
    taxonomy_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific XBRL taxonomy"""
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    return {
        'id': taxonomy.id,
        'tenant_id': taxonomy.tenant_id,
        'name': taxonomy.name,
        'description': taxonomy.description,
        'version': taxonomy.version,
        'namespace': taxonomy.namespace,
        'entry_point_uri': taxonomy.entry_point_uri,
        'concept_count': len(taxonomy.concepts) if taxonomy.concepts else 0,
        'dimension_count': len(taxonomy.dimensions) if taxonomy.dimensions else 0,
        'is_active': taxonomy.is_active,
        'created_at': taxonomy.created_at
    }


@router.get("/{taxonomy_id}/concepts", response_model=List[ConceptResponse])
async def list_taxonomy_concepts(
    taxonomy_id: UUID,
    search: str = None,
    abstract_only: bool = False,
    skip: int = 0,
    limit: int = 500,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all concepts in a taxonomy.
    
    Concepts are enriched with labels from the label linkbase.
    """
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    concepts = taxonomy.concepts or []
    labels = taxonomy.label_linkbase or {}
    
    # Filter and enrich
    results = []
    for concept in concepts:
        # Apply filters
        if abstract_only and not concept.get('abstract', False):
            continue
        if search and search.lower() not in concept.get('name', '').lower():
            # Also search in labels
            concept_labels = labels.get(concept.get('id', ''), {})
            if not any(search.lower() in lbl.lower() for lbl in concept_labels.values()):
                continue
        
        # Get label (prefer English)
        concept_id = concept.get('id', '')
        concept_labels = labels.get(concept_id, {})
        label = concept_labels.get('en', concept_labels.get('en-US', None))
        
        results.append(ConceptResponse(
            name=concept.get('name', ''),
            id=concept_id,
            element_type=concept.get('element_type', ''),
            period_type=concept.get('period_type'),
            balance=concept.get('balance'),
            abstract=concept.get('abstract', False),
            nillable=concept.get('nillable', True),
            label=label,
            documentation=concept.get('documentation')
        ))
    
    # Apply pagination
    return results[skip:skip+limit]


@router.get("/{taxonomy_id}/dimensions", response_model=List[DimensionResponse])
async def list_taxonomy_dimensions(
    taxonomy_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all dimensions in a taxonomy.
    
    Dimensions define the axes for multi-dimensional fact reporting.
    """
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    dimensions = taxonomy.dimensions or []
    
    return [DimensionResponse(
        name=d.get('name', ''),
        id=d.get('id', ''),
        dimension_type=d.get('dimension_type', 'explicit'),
        domain=d.get('domain'),
        members=d.get('members', []),
        default_member=d.get('default_member')
    ) for d in dimensions]


@router.get("/{taxonomy_id}/presentation")
async def get_presentation_tree(
    taxonomy_id: UUID,
    role: str = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the presentation hierarchy for a taxonomy.
    
    Returns the tree structure used for organizing concepts in reports.
    """
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    presentation = taxonomy.presentation_linkbase or {}
    labels = taxonomy.label_linkbase or {}
    
    if role:
        if role not in presentation:
            raise HTTPException(status_code=404, detail=f"Role '{role}' not found")
        return {
            'role': role,
            'tree': presentation[role],
            'labels': labels
        }
    
    # Return all roles
    return {
        'roles': list(presentation.keys()),
        'presentation': presentation,
        'labels': labels
    }


@router.get("/{taxonomy_id}/calculation")
async def get_calculation_relationships(
    taxonomy_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get calculation relationships (summations) from a taxonomy.
    
    Shows which concepts sum up to parent concepts.
    """
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    return taxonomy.calculation_linkbase or {}


@router.get("/{taxonomy_id}/definition")
async def get_definition_relationships(
    taxonomy_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get definition relationships from a taxonomy.
    
    Shows dimensional relationships (hypercubes, dimension-domain links).
    """
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    return taxonomy.definition_linkbase or {}


@router.delete("/{taxonomy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_xbrl_taxonomy(
    taxonomy_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an XBRL taxonomy"""
    taxonomy = db.query(models.XBRLTaxonomy).filter(
        models.XBRLTaxonomy.id == taxonomy_id,
        models.XBRLTaxonomy.tenant_id == current_user.tenant_id
    ).first()
    
    if not taxonomy:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    
    # Audit log before deletion
    log_audit(db, current_user, models.AuditAction.DELETE, "XBRLTaxonomy", str(taxonomy.id))
    
    db.delete(taxonomy)
    db.commit()
