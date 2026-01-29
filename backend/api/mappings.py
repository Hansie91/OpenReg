"""Cross-Reference Mappings API"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID
import csv
import io

from database import get_db
from services.auth import get_current_user, log_audit
import models

router = APIRouter()


# === Pydantic Models ===

class MappingSetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class MappingSetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class MappingSetResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    entry_count: Optional[int] = 0

    class Config:
        from_attributes = True


class MappingEntryCreate(BaseModel):
    source_value: str = Field(..., min_length=1, max_length=500)
    target_value: str = Field(..., min_length=1, max_length=500)
    effective_from: date
    effective_to: Optional[date] = None
    extra_data: Optional[dict] = {}
    report_ids: Optional[List[UUID]] = []


class MappingEntryUpdate(BaseModel):
    source_value: Optional[str] = Field(None, min_length=1, max_length=500)
    target_value: Optional[str] = Field(None, min_length=1, max_length=500)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    extra_data: Optional[dict] = None
    report_ids: Optional[List[UUID]] = None


class MappingEntryResponse(BaseModel):
    id: UUID
    mapping_set_id: UUID
    source_value: str
    target_value: str
    effective_from: date
    effective_to: Optional[date]
    extra_data: dict
    report_ids: List[UUID] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# === Mapping Set Endpoints ===

@router.get("", response_model=List[MappingSetResponse])
async def list_mapping_sets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all mapping sets for the current tenant"""
    sets = db.query(models.MappingSet).filter(
        models.MappingSet.tenant_id == current_user.tenant_id
    ).order_by(models.MappingSet.created_at.desc()).all()
    
    # Count entries for each set
    results = []
    for mapping_set in sets:
        entry_count = db.query(models.CrossReferenceEntry).filter(
            models.CrossReferenceEntry.mapping_set_id == mapping_set.id
        ).count()
        
        results.append(MappingSetResponse(
            id=mapping_set.id,
            name=mapping_set.name,
            description=mapping_set.description,
            created_at=mapping_set.created_at,
            updated_at=mapping_set.updated_at,
            entry_count=entry_count
        ))
    
    return results


@router.post("", response_model=MappingSetResponse, status_code=201)
async def create_mapping_set(
    mapping_set: MappingSetCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new mapping set"""
    new_set = models.MappingSet(
        tenant_id=current_user.tenant_id,
        name=mapping_set.name,
        description=mapping_set.description
    )
    
    db.add(new_set)
    db.commit()
    db.refresh(new_set)

    log_audit(db, current_user, models.AuditAction.CREATE, "MappingSet", str(new_set.id),
              changes={"name": mapping_set.name})

    return MappingSetResponse(
        id=new_set.id,
        name=new_set.name,
        description=new_set.description,
        created_at=new_set.created_at,
        updated_at=new_set.updated_at,
        entry_count=0
    )


@router.get("/{set_id}", response_model=MappingSetResponse)
async def get_mapping_set(
    set_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific mapping set by ID"""
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    entry_count = db.query(models.CrossReferenceEntry).filter(
        models.CrossReferenceEntry.mapping_set_id == mapping_set.id
    ).count()
    
    return MappingSetResponse(
        id=mapping_set.id,
        name=mapping_set.name,
        description=mapping_set.description,
        created_at=mapping_set.created_at,
        updated_at=mapping_set.updated_at,
        entry_count=entry_count
    )


@router.put("/{set_id}", response_model=MappingSetResponse)
async def update_mapping_set(
    set_id: UUID,
    update_data: MappingSetUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a mapping set"""
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    if update_data.name is not None:
        mapping_set.name = update_data.name
    if update_data.description is not None:
        mapping_set.description = update_data.description
    
    db.commit()
    db.refresh(mapping_set)

    changes = {}
    if update_data.name is not None:
        changes["name"] = update_data.name
    if update_data.description is not None:
        changes["description"] = update_data.description
    log_audit(db, current_user, models.AuditAction.UPDATE, "MappingSet", str(mapping_set.id),
              changes=changes)

    entry_count = db.query(models.CrossReferenceEntry).filter(
        models.CrossReferenceEntry.mapping_set_id == mapping_set.id
    ).count()

    return MappingSetResponse(
        id=mapping_set.id,
        name=mapping_set.name,
        description=mapping_set.description,
        created_at=mapping_set.created_at,
        updated_at=mapping_set.updated_at,
        entry_count=entry_count
    )


@router.delete("/{set_id}", status_code=204)
async def delete_mapping_set(
    set_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a mapping set and all its entries"""
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")

    mapping_set_id_str = str(mapping_set.id)
    log_audit(db, current_user, models.AuditAction.DELETE, "MappingSet", mapping_set_id_str)

    db.delete(mapping_set)
    db.commit()

    return None


# === Mapping Entry Endpoints ===

@router.get("/{set_id}/entries", response_model=List[MappingEntryResponse])
async def list_mapping_entries(
    set_id: UUID,
    effective_date: Optional[date] = Query(None, description="Filter by effective date"),
    search: Optional[str] = Query(None, description="Search source or target values"),
    sort_by: Optional[str] = Query("source_value", description="Sort by: source_value, target_value, effective_from"),
    sort_order: Optional[str] = Query("asc", description="Sort order: asc or desc"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all entries in a mapping set with search and sorting"""
    # Verify mapping set exists and belongs to tenant
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    query = db.query(models.CrossReferenceEntry).filter(
        models.CrossReferenceEntry.mapping_set_id == set_id
    )
    
    # Apply filters
    if effective_date:
        query = query.filter(
            models.CrossReferenceEntry.effective_from <= effective_date,
            (models.CrossReferenceEntry.effective_to.is_(None) | 
             (models.CrossReferenceEntry.effective_to >= effective_date))
        )
    
    if search:
        query = query.filter(
            (models.CrossReferenceEntry.source_value.ilike(f"%{search}%")) |
            (models.CrossReferenceEntry.target_value.ilike(f"%{search}%"))
        )
    
    # Apply sorting
    sort_column = getattr(models.CrossReferenceEntry, sort_by, models.CrossReferenceEntry.source_value)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    entries = query.all()
    
    # Build response with report_ids
    results = []
    for entry in entries:
        report_ids = [report.id for report in entry.reports] if entry.reports else []
        results.append(MappingEntryResponse(
            id=entry.id,
            mapping_set_id=entry.mapping_set_id,
            source_value=entry.source_value,
            target_value=entry.target_value,
            effective_from=entry.effective_from,
            effective_to=entry.effective_to,
            extra_data=entry.extra_data or {},
            report_ids=report_ids,
            created_at=entry.created_at,
            updated_at=entry.updated_at
        ))
    
    return results


@router.post("/{set_id}/entries", response_model=MappingEntryResponse, status_code=201)
async def create_mapping_entry(
    set_id: UUID,
    entry: MappingEntryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new mapping entry with optional report associations"""
    # Verify mapping set exists and belongs to tenant
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    new_entry = models.CrossReferenceEntry(
        mapping_set_id=set_id,
        source_value=entry.source_value,
        target_value=entry.target_value,
        effective_from=entry.effective_from,
        effective_to=entry.effective_to,
        extra_data=entry.extra_data or {},
        created_by=current_user.id
    )
    
    # Associate with reports if provided
    if entry.report_ids:
        reports = db.query(models.Report).filter(
            models.Report.id.in_(entry.report_ids),
            models.Report.tenant_id == current_user.tenant_id
        ).all()
        new_entry.reports = reports
    
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    log_audit(db, current_user, models.AuditAction.CREATE, "MappingEntry", str(new_entry.id),
              changes={"source_field": entry.source_value, "target_field": entry.target_value})

    report_ids = [report.id for report in new_entry.reports] if new_entry.reports else []

    return MappingEntryResponse(
        id=new_entry.id,
        mapping_set_id=new_entry.mapping_set_id,
        source_value=new_entry.source_value,
        target_value=new_entry.target_value,
        effective_from=new_entry.effective_from,
        effective_to=new_entry.effective_to,
        extra_data=new_entry.extra_data or {},
        report_ids=report_ids,
        created_at=new_entry.created_at,
        updated_at=new_entry.updated_at
    )


@router.put("/{set_id}/entries/{entry_id}", response_model=MappingEntryResponse)
async def update_mapping_entry(
    set_id: UUID,
    entry_id: UUID,
    update_data: MappingEntryUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a mapping entry"""
    # Verify mapping set belongs to tenant
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    entry = db.query(models.CrossReferenceEntry).filter(
        models.CrossReferenceEntry.id == entry_id,
        models.CrossReferenceEntry.mapping_set_id == set_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Mapping entry not found")
    
    if update_data.source_value is not None:
        entry.source_value = update_data.source_value
    if update_data.target_value is not None:
        entry.target_value = update_data.target_value
    if update_data.effective_from is not None:
        entry.effective_from = update_data.effective_from
    if update_data.effective_to is not None:
        entry.effective_to = update_data.effective_to
    if update_data.extra_data is not None:
        entry.extra_data = update_data.extra_data
    
    entry.updated_by = current_user.id

    db.commit()
    db.refresh(entry)

    changes = {}
    if update_data.source_value is not None:
        changes["source_value"] = update_data.source_value
    if update_data.target_value is not None:
        changes["target_value"] = update_data.target_value
    if update_data.effective_from is not None:
        changes["effective_from"] = str(update_data.effective_from)
    if update_data.effective_to is not None:
        changes["effective_to"] = str(update_data.effective_to)
    log_audit(db, current_user, models.AuditAction.UPDATE, "MappingEntry", str(entry.id),
              changes=changes)

    return MappingEntryResponse.model_validate(entry)


@router.delete("/{set_id}/entries/{entry_id}", status_code=204)
async def delete_mapping_entry(
    set_id: UUID,
    entry_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a mapping entry"""
    # Verify mapping set belongs to tenant
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    entry = db.query(models.CrossReferenceEntry).filter(
        models.CrossReferenceEntry.id == entry_id,
        models.CrossReferenceEntry.mapping_set_id == set_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Mapping entry not found")

    entry_id_str = str(entry.id)
    log_audit(db, current_user, models.AuditAction.DELETE, "MappingEntry", entry_id_str)

    db.delete(entry)
    db.commit()

    return None


# === CSV Import/Export ===

@router.post("/{set_id}/import", status_code=200)
async def import_csv(
    set_id: UUID,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import mapping entries from CSV file"""
    # Verify mapping set exists and belongs to tenant
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    # Read CSV file
    content = await file.read()
    csv_content = content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_content))
    
    imported_count = 0
    errors = []
    
    for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 because row 1 is header
        try:
            # Validate required fields
            if not row.get('source_value') or not row.get('target_value') or not row.get('effective_from'):
                errors.append(f"Row {row_num}: Missing required fields")
                continue
            
            # Parse effective dates
            effective_from = datetime.strptime(row['effective_from'], '%Y-%m-%d').date()
            effective_to = None
            if row.get('effective_to'):
                effective_to = datetime.strptime(row['effective_to'], '%Y-%m-%d').date()
            
            new_entry = models.CrossReferenceEntry(
                mapping_set_id=set_id,
                source_value=row['source_value'],
                target_value=row['target_value'],
                effective_from=effective_from,
                effective_to=effective_to,
                extra_data={},
                created_by=current_user.id
            )
            
            db.add(new_entry)
            imported_count += 1
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    db.commit()
    
    return {
        "imported": imported_count,
        "errors": errors
    }


@router.get("/{set_id}/export")
async def export_csv(
    set_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export mapping entries to CSV file"""
    # Verify mapping set exists and belongs to tenant
    mapping_set = db.query(models.MappingSet).filter(
        models.MappingSet.id == set_id,
        models.MappingSet.tenant_id == current_user.tenant_id
    ).first()
    
    if not mapping_set:
        raise HTTPException(status_code=404, detail="Mapping set not found")
    
    # Get all entries
    entries = db.query(models.CrossReferenceEntry).filter(
        models.CrossReferenceEntry.mapping_set_id == set_id
    ).order_by(models.CrossReferenceEntry.source_value).all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['source_value', 'target_value', 'effective_from', 'effective_to'])
    
    # Write rows
    for entry in entries:
        writer.writerow([
            entry.source_value,
            entry.target_value,
            entry.effective_from.strftime('%Y-%m-%d'),
            entry.effective_to.strftime('%Y-%m-%d') if entry.effective_to else ''
        ])
    
    # Return as downloadable file
    output.seek(0)
    filename = f"{mapping_set.name.replace(' ', '_')}_mappings.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
