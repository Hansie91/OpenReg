"""
Templates API Router

Provides endpoints for browsing and importing pre-built report templates.
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from database import get_db
from core.problem import NotFoundError
from services.auth import get_current_user, log_audit
from services.template_loader import TemplateLoader
from services.code_generator import CodeGenerator
import models

router = APIRouter(prefix="/templates", tags=["templates"])


# Response schemas
class TemplateSummary(BaseModel):
    id: str
    name: str
    description: str
    regulation: str
    version: str
    category: str
    field_count: int
    documentation_url: str

    class Config:
        from_attributes = True


class FieldMappingDetail(BaseModel):
    sourceColumn: str
    targetXPath: str
    transform: str
    defaultValue: str
    required: bool = False
    documentation: str = ""


class TemplateConfig(BaseModel):
    mode: str
    output_format: str
    output_filename_template: str
    field_mappings: List[FieldMappingDetail]
    recommended_validations: List[str] = []


class TemplateDetail(BaseModel):
    id: str
    name: str
    description: str
    regulation: str
    version: str
    category: str
    config: TemplateConfig
    documentation_url: str

    class Config:
        from_attributes = True


class TemplateImportRequest(BaseModel):
    name: Optional[str] = Field(None, description="Custom name for the report (defaults to template name)")
    description: Optional[str] = Field(None, description="Custom description (defaults to template description)")
    connector_id: Optional[str] = Field(None, description="Connector ID for the data source")
    source_table: Optional[str] = Field(None, description="Source table name (e.g., 'schema.table')")


class ReportResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=List[TemplateSummary])
async def list_templates(
    regulation: Optional[str] = Query(None, description="Filter by regulation (MiFIR, EMIR, SFTR)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: models.User = Depends(get_current_user)
) -> List[TemplateSummary]:
    """List available pre-built report templates.

    Returns a catalog of templates that can be imported to create new reports.
    """
    templates = TemplateLoader.list_templates(regulation=regulation, category=category)
    return [TemplateSummary(**t) for t in templates]


@router.get("/{template_id}", response_model=TemplateDetail)
async def get_template(
    template_id: str,
    current_user: models.User = Depends(get_current_user)
) -> TemplateDetail:
    """Get full template details including field mappings.

    Returns complete template configuration for preview before import.
    """
    template = TemplateLoader.get_template(template_id)
    if not template:
        raise NotFoundError(detail=f"Template '{template_id}' was not found. Check the template ID and try again.")
    return TemplateDetail(**template)


@router.post("/{template_id}/import", response_model=ReportResponse)
async def import_template(
    template_id: str,
    import_request: TemplateImportRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ReportResponse:
    """Import a pre-built template as a new report.

    Creates a new report from the template with optional customizations.
    The template configuration is copied, not referenced - subsequent
    template updates will not affect imported reports.
    """
    template = TemplateLoader.get_template(template_id)
    if not template:
        raise NotFoundError(detail=f"Template '{template_id}' was not found. Check the template ID and try again.")

    # Create report from template
    report = models.Report(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=import_request.name or template["name"],
        description=import_request.description or template["description"],
        created_by=current_user.id
    )
    db.add(report)
    db.flush()

    # Prepare config - copy from template
    config = template["config"].copy()

    # Strip documentation from field mappings for storage
    if "field_mappings" in config:
        config["field_mappings"] = [
            {
                "sourceColumn": m.get("sourceColumn", ""),
                "targetXPath": m.get("targetXPath", ""),
                "transform": m.get("transform", ""),
                "defaultValue": m.get("defaultValue", "")
            }
            for m in config["field_mappings"]
        ]

    # Generate Python code from mappings if Simple Mode
    python_code = ""
    if config.get("mode") == "simple" and config.get("field_mappings"):
        source_table = import_request.source_table or "your_schema.your_table"
        python_code = CodeGenerator.generate_from_mappings(
            source_table=source_table,
            field_mappings=config["field_mappings"],
            output_format=config.get("output_format", "xml")
        )

    # Create initial version
    connector_id = None
    if import_request.connector_id:
        try:
            connector_id = uuid.UUID(import_request.connector_id)
        except ValueError:
            pass

    version = models.ReportVersion(
        id=uuid.uuid4(),
        report_id=report.id,
        major_version=1,
        minor_version=0,
        version_number=1000,
        python_code=python_code,
        connector_id=connector_id,
        config=config,
        status=models.ReportVersionStatus.DRAFT,
        created_by=current_user.id
    )
    db.add(version)
    db.flush()

    report.current_version_id = version.id
    db.commit()

    # Audit log
    log_audit(
        db, current_user, models.AuditAction.CREATE, "Report", str(report.id),
        changes={"template_id": template_id, "name": report.name, "source": "template_import"}
    )

    return ReportResponse(
        id=str(report.id),
        name=report.name,
        description=report.description
    )
