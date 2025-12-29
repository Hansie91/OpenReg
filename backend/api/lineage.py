"""Data Lineage API endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from uuid import UUID

from database import get_db
from services.auth import get_current_user
from services.lineage import LineageService
import models

router = APIRouter()


# === Response Models ===

class LineageNodeData(BaseModel):
    label: str
    entityId: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = {}


class LineageNodeResponse(BaseModel):
    id: str
    type: str
    data: LineageNodeData
    position: Dict[str, int]


class LineageEdgeData(BaseModel):
    relationshipType: str
    sourceFields: Optional[List[str]] = None
    targetFields: Optional[List[str]] = None
    transformation: Optional[str] = None


class LineageEdgeResponse(BaseModel):
    id: str
    source: str
    target: str
    type: str = "smoothstep"
    animated: bool = True
    label: Optional[str] = None
    data: LineageEdgeData


class LineageGraphResponse(BaseModel):
    nodes: List[LineageNodeResponse]
    edges: List[LineageEdgeResponse]


class LineageRebuildResponse(BaseModel):
    reports_processed: int
    nodes_created: int
    edges_created: int


class UpstreamDownstreamNode(BaseModel):
    id: str
    type: str
    name: str
    entityId: str
    entityId: str
    relationship: str
    data: Optional[LineageEdgeData] = None


class ReportLineageResponse(BaseModel):
    report: Dict[str, str]
    upstream: List[UpstreamDownstreamNode]
    downstream: List[UpstreamDownstreamNode]


# === Endpoints ===

@router.get("/graph", response_model=LineageGraphResponse)
def get_lineage_graph(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the full data lineage graph for the current tenant.
    
    Returns nodes and edges formatted for React Flow visualization.
    """
    graph = LineageService.get_lineage_graph(
        db=db,
        tenant_id=current_user.tenant_id
    )
    return graph


@router.get("/report/{report_id}", response_model=ReportLineageResponse)
def get_report_lineage(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get upstream and downstream lineage for a specific report.
    
    - Upstream: Data sources (connectors, mappings) that feed this report
    - Downstream: Destinations where this report delivers to
    """
    # Verify report belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    lineage = LineageService.get_report_lineage(
        db=db,
        report_id=report_id,
        tenant_id=current_user.tenant_id
    )
    
    if "error" in lineage:
        # Report exists but not in lineage graph - trigger rebuild
        LineageService.build_lineage_for_report(db, report_id, current_user.tenant_id)
        lineage = LineageService.get_report_lineage(db, report_id, current_user.tenant_id)
    
    return lineage


@router.post("/refresh", response_model=LineageRebuildResponse)
def refresh_lineage(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Rebuild the entire lineage graph for the current tenant.
    
    This scans all reports and their configurations to rebuild the
    complete data lineage graph. Useful after bulk imports or migrations.
    """
    result = LineageService.build_lineage_for_tenant(
        db=db,
        tenant_id=current_user.tenant_id
    )
    return result


@router.post("/report/{report_id}/rebuild")
def rebuild_report_lineage(
    report_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Rebuild lineage for a specific report.
    
    Called automatically when a report version is saved, but can also
    be triggered manually.
    """
    # Verify report belongs to tenant
    report = db.query(models.Report).filter(
        models.Report.id == report_id,
        models.Report.tenant_id == current_user.tenant_id
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    result = LineageService.build_lineage_for_report(
        db=db,
        report_id=report_id,
        tenant_id=current_user.tenant_id
    )
    return result
