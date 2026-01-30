"""
Common Domain Model (CDM) API

Endpoints for managing CDM source mappings and executing translations.
Based on the ISDA/FINOS Common Domain Model (https://cdm.finos.org/).
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from database import get_db
from services.auth import get_current_user, log_audit
from core.problem import NotFoundError, ValidationError as APIValidationError, BadRequestError
from models import (
    CanonicalSourceMapping,
    CanonicalFieldMapping,
    CanonicalTradeEvent,
    CanonicalParty,
    CanonicalProduct,
    CanonicalExecution,
    CanonicalValuation,
    CanonicalModelVersion,
    CanonicalLegalEntity,
    CanonicalInstrument,
    CanonicalVenue,
    Connector,
    User,
    AuditAction,
)
from services.canonical import CanonicalTranslator, EnrichmentService

router = APIRouter()


# =============================================================================
# SCHEMAS
# =============================================================================

class FieldMappingCreate(BaseModel):
    """Schema for creating a field mapping."""
    source_column: str = Field(..., description="Source column name")
    canonical_path: str = Field(..., description="Target canonical path (e.g., 'trade_event.uti')")
    canonical_entity: str = Field(..., description="Target entity name")
    transform_type: Optional[str] = Field(None, description="Transformation to apply")
    transform_expression: Optional[str] = None
    lookup_table: Optional[str] = None
    lookup_key_column: Optional[str] = None
    lookup_value_column: Optional[str] = None
    default_value: Optional[str] = None
    is_required: bool = False
    validation_regex: Optional[str] = None
    description: Optional[str] = None


class FieldMappingResponse(BaseModel):
    """Schema for field mapping response."""
    id: UUID
    source_column: str
    source_data_type: Optional[str]
    canonical_path: str
    canonical_entity: str
    transform_type: Optional[str]
    default_value: Optional[str]
    is_required: bool
    description: Optional[str]

    class Config:
        from_attributes = True


class SourceMappingCreate(BaseModel):
    """Schema for creating a source mapping."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    connector_id: UUID
    source_table: Optional[str] = None
    source_query: Optional[str] = None
    field_mappings: List[FieldMappingCreate] = []


class SourceMappingUpdate(BaseModel):
    """Schema for updating a source mapping."""
    name: Optional[str] = None
    description: Optional[str] = None
    connector_id: Optional[UUID] = None
    source_table: Optional[str] = None
    source_query: Optional[str] = None
    is_active: Optional[bool] = None


class SourceMappingResponse(BaseModel):
    """Schema for source mapping response."""
    id: UUID
    name: str
    description: Optional[str]
    connector_id: Optional[UUID]
    source_table: Optional[str]
    source_query: Optional[str]
    canonical_model_version: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    field_mapping_count: int = 0

    class Config:
        from_attributes = True


class SourceMappingDetailResponse(SourceMappingResponse):
    """Detailed response including field mappings."""
    field_mappings: List[FieldMappingResponse] = []


class TranslationRequest(BaseModel):
    """Schema for translation execution request."""
    parameters: dict = Field(default_factory=dict, description="Runtime parameters")
    dry_run: bool = Field(False, description="Validate without persisting")
    limit: Optional[int] = Field(None, ge=1, le=10000, description="Max rows to process")
    enrich: bool = Field(True, description="Run enrichment after translation")


class TranslationResponse(BaseModel):
    """Schema for translation result."""
    success: bool
    trade_events_created: int
    parties_created: int
    products_created: int
    executions_created: int
    rows_processed: int
    rows_failed: int
    errors: List[dict]
    warnings: List[str]
    trade_event_ids: List[str]
    duration_ms: int


class CanonicalVersionResponse(BaseModel):
    """Schema for canonical model version."""
    id: UUID
    version: str
    cdm_version: str
    effective_from: datetime
    effective_to: Optional[datetime]
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class TradeEventSummary(BaseModel):
    """Summary of a canonical trade event."""
    id: UUID
    event_type: str
    action_type: str
    uti: Optional[str]
    internal_trade_id: str
    event_timestamp: datetime
    reporting_jurisdiction: str
    party_count: int = 0
    has_product: bool = False
    has_execution: bool = False

    class Config:
        from_attributes = True


# =============================================================================
# SOURCE MAPPING ENDPOINTS
# =============================================================================

@router.get("/mappings", response_model=List[SourceMappingResponse])
async def list_source_mappings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    active_only: bool = Query(True, description="Filter to active mappings only")
):
    """List all canonical source mappings for the tenant."""
    query = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    )

    if active_only:
        query = query.filter(CanonicalSourceMapping.is_active == True)

    mappings = query.order_by(CanonicalSourceMapping.name).all()

    # Add field mapping counts
    results = []
    for mapping in mappings:
        count = db.query(CanonicalFieldMapping).filter(
            CanonicalFieldMapping.source_mapping_id == mapping.id
        ).count()

        response = SourceMappingResponse.model_validate(mapping)
        response.field_mapping_count = count
        results.append(response)

    return results


@router.post("/mappings", response_model=SourceMappingDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_source_mapping(
    data: SourceMappingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new canonical source mapping."""
    # Verify connector exists
    connector = db.query(Connector).filter(
        Connector.id == data.connector_id,
        Connector.tenant_id == current_user.tenant_id
    ).first()

    if not connector:
        raise NotFoundError(detail=f"Connector not found: {data.connector_id}")

    # Get current canonical model version
    current_version = db.query(CanonicalModelVersion).filter(
        CanonicalModelVersion.is_active == True
    ).first()

    version_str = current_version.version if current_version else "2.0.0"

    # Create source mapping
    mapping = CanonicalSourceMapping(
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        connector_id=data.connector_id,
        source_table=data.source_table,
        source_query=data.source_query,
        canonical_model_version=version_str,
        created_by=current_user.id
    )

    db.add(mapping)
    db.flush()

    # Create field mappings
    for fm_data in data.field_mappings:
        field_mapping = CanonicalFieldMapping(
            source_mapping_id=mapping.id,
            source_column=fm_data.source_column,
            canonical_path=fm_data.canonical_path,
            canonical_entity=fm_data.canonical_entity,
            transform_type=fm_data.transform_type,
            transform_expression=fm_data.transform_expression,
            lookup_table=fm_data.lookup_table,
            lookup_key_column=fm_data.lookup_key_column,
            lookup_value_column=fm_data.lookup_value_column,
            default_value=fm_data.default_value,
            is_required=fm_data.is_required,
            validation_regex=fm_data.validation_regex,
            description=fm_data.description
        )
        db.add(field_mapping)

    db.commit()
    db.refresh(mapping)

    log_audit(db, current_user, AuditAction.CREATE, "CanonicalSourceMapping", str(mapping.id))

    # Build response
    field_mappings = db.query(CanonicalFieldMapping).filter(
        CanonicalFieldMapping.source_mapping_id == mapping.id
    ).all()

    return SourceMappingDetailResponse(
        id=mapping.id,
        name=mapping.name,
        description=mapping.description,
        connector_id=mapping.connector_id,
        source_table=mapping.source_table,
        source_query=mapping.source_query,
        canonical_model_version=mapping.canonical_model_version,
        is_active=mapping.is_active,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
        field_mapping_count=len(field_mappings),
        field_mappings=[FieldMappingResponse.model_validate(fm) for fm in field_mappings]
    )


@router.get("/mappings/{mapping_id}", response_model=SourceMappingDetailResponse)
async def get_source_mapping(
    mapping_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a source mapping with its field mappings."""
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    field_mappings = db.query(CanonicalFieldMapping).filter(
        CanonicalFieldMapping.source_mapping_id == mapping_id
    ).all()

    return SourceMappingDetailResponse(
        id=mapping.id,
        name=mapping.name,
        description=mapping.description,
        connector_id=mapping.connector_id,
        source_table=mapping.source_table,
        source_query=mapping.source_query,
        canonical_model_version=mapping.canonical_model_version,
        is_active=mapping.is_active,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
        field_mapping_count=len(field_mappings),
        field_mappings=[FieldMappingResponse.model_validate(fm) for fm in field_mappings]
    )


@router.put("/mappings/{mapping_id}", response_model=SourceMappingResponse)
async def update_source_mapping(
    mapping_id: UUID,
    data: SourceMappingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a source mapping."""
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    # Update fields
    if data.name is not None:
        mapping.name = data.name
    if data.description is not None:
        mapping.description = data.description
    if data.connector_id is not None:
        # Verify connector exists
        connector = db.query(Connector).filter(
            Connector.id == data.connector_id,
            Connector.tenant_id == current_user.tenant_id
        ).first()
        if not connector:
            raise NotFoundError(detail=f"Connector not found: {data.connector_id}")
        mapping.connector_id = data.connector_id
    if data.source_table is not None:
        mapping.source_table = data.source_table
    if data.source_query is not None:
        mapping.source_query = data.source_query
    if data.is_active is not None:
        mapping.is_active = data.is_active

    db.commit()
    db.refresh(mapping)

    log_audit(db, current_user, AuditAction.UPDATE, "CanonicalSourceMapping", str(mapping.id))

    count = db.query(CanonicalFieldMapping).filter(
        CanonicalFieldMapping.source_mapping_id == mapping.id
    ).count()

    response = SourceMappingResponse.model_validate(mapping)
    response.field_mapping_count = count
    return response


@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_mapping(
    mapping_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a source mapping and its field mappings."""
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    log_audit(db, current_user, AuditAction.DELETE, "CanonicalSourceMapping", str(mapping.id))

    # Delete field mappings first
    db.query(CanonicalFieldMapping).filter(
        CanonicalFieldMapping.source_mapping_id == mapping_id
    ).delete()

    db.delete(mapping)
    db.commit()


# =============================================================================
# FIELD MAPPING ENDPOINTS
# =============================================================================

@router.post("/mappings/{mapping_id}/fields", response_model=FieldMappingResponse, status_code=status.HTTP_201_CREATED)
async def add_field_mapping(
    mapping_id: UUID,
    data: FieldMappingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a field mapping to a source mapping."""
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    # Check for duplicate
    existing = db.query(CanonicalFieldMapping).filter(
        CanonicalFieldMapping.source_mapping_id == mapping_id,
        CanonicalFieldMapping.canonical_path == data.canonical_path
    ).first()

    if existing:
        raise APIValidationError(
            detail=f"Field mapping already exists for path: {data.canonical_path}"
        )

    field_mapping = CanonicalFieldMapping(
        source_mapping_id=mapping_id,
        source_column=data.source_column,
        canonical_path=data.canonical_path,
        canonical_entity=data.canonical_entity,
        transform_type=data.transform_type,
        transform_expression=data.transform_expression,
        lookup_table=data.lookup_table,
        lookup_key_column=data.lookup_key_column,
        lookup_value_column=data.lookup_value_column,
        default_value=data.default_value,
        is_required=data.is_required,
        validation_regex=data.validation_regex,
        description=data.description
    )

    db.add(field_mapping)
    db.commit()
    db.refresh(field_mapping)

    return FieldMappingResponse.model_validate(field_mapping)


@router.delete("/mappings/{mapping_id}/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_mapping(
    mapping_id: UUID,
    field_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a field mapping."""
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    field_mapping = db.query(CanonicalFieldMapping).filter(
        CanonicalFieldMapping.id == field_id,
        CanonicalFieldMapping.source_mapping_id == mapping_id
    ).first()

    if not field_mapping:
        raise NotFoundError(detail=f"Field mapping not found: {field_id}")

    db.delete(field_mapping)
    db.commit()


# =============================================================================
# TRANSLATION ENDPOINTS
# =============================================================================

@router.post("/mappings/{mapping_id}/translate", response_model=TranslationResponse)
async def execute_translation(
    mapping_id: UUID,
    data: TranslationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute translation from source to canonical model.

    This runs the "Translate" step of the DRR pipeline.
    """
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    if not mapping.is_active:
        raise APIValidationError(detail="Source mapping is inactive")

    # Execute translation
    translator = CanonicalTranslator(db, current_user.tenant_id)
    result = translator.translate(
        source_mapping_id=mapping_id,
        parameters=data.parameters,
        dry_run=data.dry_run,
        limit=data.limit
    )

    # Run enrichment if requested and translation succeeded
    if data.enrich and result.success and result.trade_event_ids and not data.dry_run:
        enrichment_service = EnrichmentService(db)
        enrichment_service.enrich_trade_events(result.trade_event_ids)

    log_audit(
        db, current_user, AuditAction.CREATE,
        "CanonicalTranslation",
        str(mapping_id),
        {"rows_processed": result.rows_processed, "dry_run": data.dry_run}
    )

    return TranslationResponse(**result.to_dict())


@router.post("/mappings/{mapping_id}/preview")
async def preview_translation(
    mapping_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=100)
):
    """
    Preview translation results without persisting.

    Returns sample canonical records that would be created.
    """
    mapping = db.query(CanonicalSourceMapping).filter(
        CanonicalSourceMapping.id == mapping_id,
        CanonicalSourceMapping.tenant_id == current_user.tenant_id
    ).first()

    if not mapping:
        raise NotFoundError(detail=f"Source mapping not found: {mapping_id}")

    # Run dry-run translation
    translator = CanonicalTranslator(db, current_user.tenant_id)
    result = translator.translate(
        source_mapping_id=mapping_id,
        parameters={},
        dry_run=True,
        limit=limit
    )

    return {
        "preview": result.to_dict(),
        "sample_size": limit
    }


# =============================================================================
# TRADE EVENT ENDPOINTS
# =============================================================================

@router.get("/trade-events", response_model=List[TradeEventSummary])
async def list_trade_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """List canonical trade events for the tenant."""
    events = db.query(CanonicalTradeEvent).filter(
        CanonicalTradeEvent.tenant_id == current_user.tenant_id
    ).order_by(
        CanonicalTradeEvent.event_timestamp.desc()
    ).offset(offset).limit(limit).all()

    results = []
    for event in events:
        party_count = db.query(CanonicalParty).filter(
            CanonicalParty.trade_event_id == event.id
        ).count()

        has_product = db.query(CanonicalProduct).filter(
            CanonicalProduct.trade_event_id == event.id
        ).first() is not None

        has_execution = db.query(CanonicalExecution).filter(
            CanonicalExecution.trade_event_id == event.id
        ).first() is not None

        results.append(TradeEventSummary(
            id=event.id,
            event_type=event.event_type.value,
            action_type=event.action_type.value,
            uti=event.uti,
            internal_trade_id=event.internal_trade_id,
            event_timestamp=event.event_timestamp,
            reporting_jurisdiction=event.reporting_jurisdiction,
            party_count=party_count,
            has_product=has_product,
            has_execution=has_execution
        ))

    return results


@router.get("/trade-events/{event_id}")
async def get_trade_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed canonical trade event with all related entities."""
    event = db.query(CanonicalTradeEvent).filter(
        CanonicalTradeEvent.id == event_id,
        CanonicalTradeEvent.tenant_id == current_user.tenant_id
    ).first()

    if not event:
        raise NotFoundError(detail=f"Trade event not found: {event_id}")

    parties = db.query(CanonicalParty).filter(
        CanonicalParty.trade_event_id == event_id
    ).all()

    product = db.query(CanonicalProduct).filter(
        CanonicalProduct.trade_event_id == event_id
    ).first()

    execution = db.query(CanonicalExecution).filter(
        CanonicalExecution.trade_event_id == event_id
    ).first()

    valuations = db.query(CanonicalValuation).filter(
        CanonicalValuation.trade_event_id == event_id
    ).order_by(CanonicalValuation.valuation_date.desc()).all()

    return {
        "trade_event": {
            "id": str(event.id),
            "event_type": event.event_type.value,
            "action_type": event.action_type.value,
            "event_timestamp": event.event_timestamp.isoformat(),
            "uti": event.uti,
            "prior_uti": event.prior_uti,
            "internal_trade_id": event.internal_trade_id,
            "venue_transaction_id": event.venue_transaction_id,
            "reporting_jurisdiction": event.reporting_jurisdiction,
            "execution_timestamp": event.execution_timestamp.isoformat() if event.execution_timestamp else None,
            "effective_date": event.effective_date.isoformat() if event.effective_date else None,
            "maturity_date": event.maturity_date.isoformat() if event.maturity_date else None,
            "clearing_status": event.clearing_status.value if event.clearing_status else None,
            "ccp_lei": event.ccp_lei,
            "collateralised": event.collateralised,
            "source_system": event.source_system,
            "source_record_id": event.source_record_id,
            "canonical_version": event.canonical_version,
            "created_at": event.created_at.isoformat(),
        },
        "parties": [
            {
                "id": str(p.id),
                "party_role": p.party_role.value,
                "party_type": p.party_type.value,
                "lei": p.lei,
                "entity_name": p.entity_name,
                "country_of_domicile": p.country_of_domicile,
                "country_of_branch": p.country_of_branch,
                "is_financial_counterparty": p.is_financial_counterparty,
            }
            for p in parties
        ],
        "product": {
            "id": str(product.id),
            "asset_class": product.asset_class.value,
            "product_type": product.product_type.value,
            "isin": product.isin,
            "instrument_name": product.instrument_name,
            "notional_amount": str(product.notional_amount) if product.notional_amount else None,
            "notional_currency": product.notional_currency,
            "price": str(product.price) if product.price else None,
            "price_currency": product.price_currency,
            "effective_date": product.effective_date.isoformat() if product.effective_date else None,
            "maturity_date": product.maturity_date.isoformat() if product.maturity_date else None,
        } if product else None,
        "execution": {
            "id": str(execution.id),
            "execution_type": execution.execution_type.value if execution.execution_type else None,
            "trading_venue_mic": execution.trading_venue_mic,
            "execution_timestamp": execution.execution_timestamp.isoformat(),
            "waiver_indicator": execution.waiver_indicator,
            "short_selling_indicator": execution.short_selling_indicator,
        } if execution else None,
        "valuations": [
            {
                "id": str(v.id),
                "valuation_date": v.valuation_date.isoformat(),
                "mtm_value": str(v.mtm_value) if v.mtm_value else None,
                "mtm_currency": v.mtm_currency,
            }
            for v in valuations
        ]
    }


# =============================================================================
# VERSION ENDPOINTS
# =============================================================================

@router.get("/versions", response_model=List[CanonicalVersionResponse])
async def list_canonical_versions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all canonical model versions."""
    versions = db.query(CanonicalModelVersion).order_by(
        CanonicalModelVersion.effective_from.desc()
    ).all()

    return [CanonicalVersionResponse.model_validate(v) for v in versions]


@router.get("/versions/current", response_model=CanonicalVersionResponse)
async def get_current_version(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current active canonical model version."""
    version = db.query(CanonicalModelVersion).filter(
        CanonicalModelVersion.is_active == True
    ).first()

    if not version:
        raise NotFoundError(detail="No active canonical model version found")

    return CanonicalVersionResponse.model_validate(version)


# =============================================================================
# REFERENCE DATA ENDPOINTS
# =============================================================================

@router.get("/reference/legal-entities")
async def list_legal_entities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None
):
    """List legal entities in reference data."""
    query = db.query(CanonicalLegalEntity)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (CanonicalLegalEntity.lei.ilike(search_term)) |
            (CanonicalLegalEntity.legal_name.ilike(search_term))
        )

    entities = query.limit(limit).all()

    return [
        {
            "lei": e.lei,
            "legal_name": e.legal_name,
            "headquarters_country": e.headquarters_country,
            "entity_status": e.entity_status,
            "is_financial_institution": e.is_financial_institution,
            "last_updated": e.last_updated.isoformat() if e.last_updated else None,
        }
        for e in entities
    ]


@router.get("/reference/instruments")
async def list_instruments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None
):
    """List instruments in reference data."""
    query = db.query(CanonicalInstrument)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (CanonicalInstrument.isin.ilike(search_term)) |
            (CanonicalInstrument.instrument_name.ilike(search_term))
        )

    instruments = query.limit(limit).all()

    return [
        {
            "isin": i.isin,
            "instrument_name": i.instrument_name,
            "cfi_code": i.cfi_code,
            "maturity_date": i.maturity_date.isoformat() if i.maturity_date else None,
        }
        for i in instruments
    ]


# =============================================================================
# RULE ENGINE ENDPOINTS
# =============================================================================

class ValidationRequest(BaseModel):
    """Request schema for validation."""
    trade_event_ids: List[str] = Field(..., description="List of trade event IDs to validate")
    regulations: List[str] = Field(default=[], description="Regulations to validate against (EMIR, MIFIR, SFTR)")
    include_warnings: bool = Field(default=True, description="Include warning-level validations")


class ValidationResponse(BaseModel):
    """Response schema for validation."""
    total_events: int
    valid_events: int
    invalid_events: int
    total_errors: int
    total_warnings: int
    pass_rate: float
    errors_by_field: Dict[str, int]
    errors_by_code: Dict[str, int]


class ProjectionRequest(BaseModel):
    """Request schema for projection."""
    trade_event_ids: List[str] = Field(..., description="List of trade event IDs to project")
    regulation: str = Field(..., description="Target regulation (EMIR, MIFIR, SFTR)")
    report_date: Optional[str] = Field(None, description="Reporting date (YYYY-MM-DD)")


class RulePackageRequest(BaseModel):
    """Request schema for executing a rule package."""
    trade_event_ids: List[str] = Field(..., description="List of trade event IDs to process")
    regulation: str = Field(..., description="Target regulation (EMIR, MIFIR, SFTR)")
    run_validation: bool = Field(default=True, description="Run validation step")
    run_projection: bool = Field(default=True, description="Run projection step")
    report_date: Optional[str] = Field(None, description="Reporting date (YYYY-MM-DD)")


@router.post("/validate")
async def validate_trade_events(
    request: ValidationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate canonical trade events against CDM rules and regulatory requirements.

    Validates:
    - Field formats (LEI, ISIN, UTI, MIC, etc.)
    - Required fields
    - Cross-field consistency
    - Regulatory-specific rules (EMIR, MiFIR, SFTR)

    Returns validation results with errors categorized by severity.
    """
    from services.canonical import CanonicalValidationService
    from uuid import UUID

    # Convert string IDs to UUIDs
    try:
        trade_event_ids = [UUID(id_str) for id_str in request.trade_event_ids]
    except ValueError as e:
        raise BadRequestError(detail=f"Invalid trade event ID format: {e}")

    # Verify trade events belong to user's tenant
    events = db.query(CanonicalTradeEvent).filter(
        CanonicalTradeEvent.id.in_(trade_event_ids),
        CanonicalTradeEvent.tenant_id == current_user.tenant_id
    ).all()

    if len(events) != len(trade_event_ids):
        found_ids = {e.id for e in events}
        missing = [str(id) for id in trade_event_ids if id not in found_ids]
        raise NotFoundError(detail=f"Trade events not found or not accessible: {missing}")

    # Run validation
    validation_service = CanonicalValidationService(
        db,
        regulations=request.regulations
    )
    result = validation_service.validate_trade_events(
        trade_event_ids,
        include_warnings=request.include_warnings
    )

    return result.to_dict()


@router.post("/project")
async def project_trade_events(
    request: ProjectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Project canonical trade events to a regulatory report format.

    Supported regulations:
    - EMIR (European Market Infrastructure Regulation) - REFIT format
    - MIFIR (Markets in Financial Instruments Regulation) - RTS 25 format
    - SFTR (Securities Financing Transactions Regulation)

    Returns projected records with fields mapped to the regulatory schema.
    """
    from services.canonical import CanonicalProjectionService
    from uuid import UUID
    from datetime import datetime

    # Validate regulation
    regulation = request.regulation.upper()
    if regulation not in ("EMIR", "MIFIR", "SFTR"):
        raise BadRequestError(detail=f"Unsupported regulation: {regulation}. Supported: EMIR, MIFIR, SFTR")

    # Convert string IDs to UUIDs
    try:
        trade_event_ids = [UUID(id_str) for id_str in request.trade_event_ids]
    except ValueError as e:
        raise BadRequestError(detail=f"Invalid trade event ID format: {e}")

    # Parse report date
    report_date = None
    if request.report_date:
        try:
            report_date = datetime.strptime(request.report_date, "%Y-%m-%d").date()
        except ValueError:
            raise BadRequestError(detail=f"Invalid report_date format. Expected YYYY-MM-DD")

    # Verify trade events belong to user's tenant
    events = db.query(CanonicalTradeEvent).filter(
        CanonicalTradeEvent.id.in_(trade_event_ids),
        CanonicalTradeEvent.tenant_id == current_user.tenant_id
    ).all()

    if len(events) != len(trade_event_ids):
        found_ids = {e.id for e in events}
        missing = [str(id) for id in trade_event_ids if id not in found_ids]
        raise NotFoundError(detail=f"Trade events not found or not accessible: {missing}")

    # Run projection
    projection_service = CanonicalProjectionService(db)
    result = projection_service.project(trade_event_ids, regulation, report_date)

    return result.to_dict()


@router.post("/execute-rules")
async def execute_rule_package(
    request: RulePackageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute a complete rule package (validation + projection) for a regulation.

    This is the main endpoint for the DRR (Digital Regulatory Reporting) pipeline:
    1. Validates canonical trade events against the regulation's rules
    2. Projects valid trade events to the regulatory report format

    Only trade events that pass validation are included in the projection output.
    """
    from services.canonical import RulePackageExecutor
    from uuid import UUID
    from datetime import datetime

    # Validate regulation
    regulation = request.regulation.upper()
    if regulation not in ("EMIR", "MIFIR", "SFTR"):
        raise BadRequestError(detail=f"Unsupported regulation: {regulation}. Supported: EMIR, MIFIR, SFTR")

    # Convert string IDs to UUIDs
    try:
        trade_event_ids = [UUID(id_str) for id_str in request.trade_event_ids]
    except ValueError as e:
        raise BadRequestError(detail=f"Invalid trade event ID format: {e}")

    # Parse report date
    report_date = None
    if request.report_date:
        try:
            report_date = datetime.strptime(request.report_date, "%Y-%m-%d").date()
        except ValueError:
            raise BadRequestError(detail=f"Invalid report_date format. Expected YYYY-MM-DD")

    # Verify trade events belong to user's tenant
    events = db.query(CanonicalTradeEvent).filter(
        CanonicalTradeEvent.id.in_(trade_event_ids),
        CanonicalTradeEvent.tenant_id == current_user.tenant_id
    ).all()

    if len(events) != len(trade_event_ids):
        found_ids = {e.id for e in events}
        missing = [str(id) for id in trade_event_ids if id not in found_ids]
        raise NotFoundError(detail=f"Trade events not found or not accessible: {missing}")

    # Execute rule package
    executor = RulePackageExecutor(db)
    result = executor.execute(
        trade_event_ids=trade_event_ids,
        regulation=regulation,
        validate=request.run_validation,
        project=request.run_projection,
        report_date=report_date
    )

    # Audit log
    log_audit(
        db, current_user, AuditAction.EXECUTE,
        "CanonicalRulePackage", regulation,
        changes={
            "trade_event_count": len(trade_event_ids),
            "regulation": regulation,
            "run_validation": request.run_validation,
            "run_projection": request.run_projection,
        }
    )

    return result


@router.get("/regulations")
async def list_supported_regulations(
    current_user: User = Depends(get_current_user)
):
    """
    List supported regulations and their rule packages.

    Returns information about available regulations including:
    - Regulation code and name
    - Validation rules summary
    - Projection format details
    """
    return {
        "regulations": [
            {
                "code": "EMIR",
                "name": "European Market Infrastructure Regulation",
                "version": "REFIT",
                "description": "EU derivatives reporting regulation (EMIR REFIT)",
                "validation_rules": {
                    "required_fields": ["uti", "reporting_counterparty.lei", "other_counterparty", "notional_amount"],
                    "format_validations": ["lei", "uti", "isin", "mic"],
                    "cross_field_rules": ["cleared_requires_ccp", "lifecycle_requires_prior_uti"]
                },
                "projection_fields": 50,
                "output_format": "ISO 20022 XML"
            },
            {
                "code": "MIFIR",
                "name": "Markets in Financial Instruments Regulation",
                "version": "RTS 25",
                "description": "EU transaction reporting for financial instruments",
                "validation_rules": {
                    "required_fields": ["trading_venue_mic", "execution_timestamp", "price", "quantity", "buyer", "seller"],
                    "format_validations": ["lei", "isin", "mic", "national_id"],
                    "cross_field_rules": ["buyer_seller_different", "price_positive"]
                },
                "projection_fields": 65,
                "output_format": "ISO 20022 XML"
            },
            {
                "code": "SFTR",
                "name": "Securities Financing Transactions Regulation",
                "version": "2.0",
                "description": "EU reporting for securities financing transactions",
                "validation_rules": {
                    "required_fields": ["uti", "reporting_counterparty.lei", "collateralization"],
                    "format_validations": ["lei", "uti", "isin"],
                    "cross_field_rules": ["margin_currency_consistency"]
                },
                "projection_fields": 155,
                "output_format": "ISO 20022 XML"
            }
        ]
    }


# =============================================================================
# REGULATION PACKAGE ENDPOINTS
# =============================================================================

@router.get("/packages")
async def list_regulation_packages(
    current_user: User = Depends(get_current_user)
):
    """
    List all available regulation packages.

    Returns summaries of pre-built packages for EMIR, MiFIR, and SFTR.
    """
    from services.canonical import RegulationPackageRegistry

    packages = RegulationPackageRegistry.list_packages()
    return {
        "packages": packages,
        "total": len(packages)
    }


@router.get("/packages/{package_id}")
async def get_regulation_package(
    package_id: str,
    current_user: User = Depends(get_current_user),
    include_fields: bool = Query(True, description="Include field specifications"),
    include_rules: bool = Query(True, description="Include validation rules")
):
    """
    Get a regulation package by ID or regulation code.

    Returns the full package definition including fields and validation rules.
    """
    from services.canonical import RegulationPackageRegistry

    package = RegulationPackageRegistry.get_package(package_id)
    if not package:
        raise NotFoundError(detail=f"Regulation package not found: {package_id}")

    result = package.to_dict()

    # Optionally exclude fields or rules for smaller response
    if not include_fields:
        result.pop("fields", None)
    if not include_rules:
        result.pop("validation_rules", None)

    return result


@router.get("/packages/{package_id}/fields")
async def get_package_fields(
    package_id: str,
    current_user: User = Depends(get_current_user),
    requirement: Optional[str] = Query(None, description="Filter by requirement: mandatory, conditional, optional"),
    search: Optional[str] = Query(None, description="Search in field name or description")
):
    """
    Get field specifications for a regulation package.

    Filter by requirement level or search by name/description.
    """
    from services.canonical import RegulationPackageRegistry, FieldRequirement

    package = RegulationPackageRegistry.get_package(package_id)
    if not package:
        raise NotFoundError(detail=f"Regulation package not found: {package_id}")

    fields = package.fields

    # Filter by requirement
    if requirement:
        try:
            req = FieldRequirement(requirement.lower())
            fields = [f for f in fields if f.requirement == req]
        except ValueError:
            raise BadRequestError(detail=f"Invalid requirement: {requirement}. Use: mandatory, conditional, optional")

    # Search
    if search:
        search_lower = search.lower()
        fields = [
            f for f in fields
            if search_lower in f.field_name.lower() or search_lower in f.description.lower()
        ]

    return {
        "package_id": package_id,
        "regulation": package.regulation_code,
        "total_fields": len(fields),
        "fields": [f.to_dict() for f in fields]
    }


@router.get("/packages/{package_id}/rules")
async def get_package_validation_rules(
    package_id: str,
    current_user: User = Depends(get_current_user),
    severity: Optional[str] = Query(None, description="Filter by severity: ERROR, WARNING, INFO"),
    rule_type: Optional[str] = Query(None, description="Filter by type: format, required, cross_field, business")
):
    """
    Get validation rules for a regulation package.

    Filter by severity or rule type.
    """
    from services.canonical import RegulationPackageRegistry

    package = RegulationPackageRegistry.get_package(package_id)
    if not package:
        raise NotFoundError(detail=f"Regulation package not found: {package_id}")

    rules = package.validation_rules

    # Filter by severity
    if severity:
        severity_upper = severity.upper()
        rules = [r for r in rules if r.severity == severity_upper]

    # Filter by rule type
    if rule_type:
        rules = [r for r in rules if r.rule_type == rule_type.lower()]

    return {
        "package_id": package_id,
        "regulation": package.regulation_code,
        "total_rules": len(rules),
        "rules": [r.to_dict() for r in rules]
    }


@router.get("/packages/{package_id}/cdm-mapping")
async def get_package_cdm_mapping(
    package_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get the Common Domain Model (CDM) mapping for a regulation package.

    Shows how CDM fields map to regulatory report fields.
    """
    from services.canonical import RegulationPackageRegistry

    package = RegulationPackageRegistry.get_package(package_id)
    if not package:
        raise NotFoundError(detail=f"Regulation package not found: {package_id}")

    mappings = []
    for field in package.fields:
        if field.cdm_path:
            mappings.append({
                "regulatory_field_id": field.field_id,
                "regulatory_field_name": field.field_name,
                "cdm_path": field.cdm_path,
                "transform": field.transform,
                "requirement": field.requirement.value,
                "data_type": field.data_type.value,
            })

    return {
        "package_id": package_id,
        "regulation": package.regulation_code,
        "total_mappings": len(mappings),
        "mappings": mappings
    }


@router.post("/packages/{package_id}/generate-report-config")
async def generate_report_config_from_package(
    package_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a report configuration from a regulation package.

    Creates a ready-to-use report configuration that can be imported
    to create a new report based on the regulation package.
    """
    from services.canonical import RegulationPackageRegistry

    package = RegulationPackageRegistry.get_package(package_id)
    if not package:
        raise NotFoundError(detail=f"Regulation package not found: {package_id}")

    # Generate report configuration
    config = {
        "name": f"{package.regulation_code} Report",
        "description": package.description,
        "regulation": package.regulation_code,
        "version": package.version,
        "output_format": package.output_format.lower(),
        "schema": {
            "namespace": package.output_namespace,
            "root_element": package.output_root_element,
            "schema_url": package.output_schema,
        },
        "fields": [
            {
                "id": f.field_id,
                "name": f.field_name,
                "xml_element": f.xml_element,
                "data_type": f.data_type.value,
                "required": f.requirement == "mandatory",
                "cdm_path": f.cdm_path,
                "transform": f.transform,
                "validation": {
                    "pattern": f.pattern,
                    "max_length": f.max_length,
                    "min_length": f.min_length,
                    "enum_values": f.enum_values,
                },
            }
            for f in package.fields
        ],
        "validation_rules": [
            {
                "rule_id": r.rule_id,
                "name": r.name,
                "severity": r.severity,
                "expression": r.expression,
                "error_message": r.error_message,
            }
            for r in package.validation_rules
        ],
        "metadata": {
            "package_id": package.package_id,
            "jurisdiction": package.jurisdiction,
            "reporting_authority": package.reporting_authority,
            "effective_date": package.effective_date,
            "tags": package.tags,
        }
    }

    return {
        "package_id": package_id,
        "regulation": package.regulation_code,
        "config": config,
        "instructions": {
            "step_1": "Copy the 'config' object",
            "step_2": "Create a new report using POST /api/v1/reports",
            "step_3": "Include the config in the request body",
            "step_4": "Create a source mapping to map your data to canonical model",
            "step_5": "Execute the report using POST /api/v1/reports/{id}/execute"
        }
    }
