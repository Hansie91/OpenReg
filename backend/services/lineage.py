"""
Data Lineage Service

Builds and maintains the data lineage graph that tracks how data flows
from connectors through reports to outputs.

Phase 1: High-level report ↔ connector relationships
Phase 2: Field-level column mappings (placeholders ready)
"""

import logging
from typing import Dict, List, Any, Optional
from uuid import UUID
import re
import ast

from sqlalchemy.orm import Session
from sqlalchemy import and_

import models


class PythonLineageParser:
    """Parses Python code to extract lineage information using AST"""
    
    @staticmethod
    def parse(code: str) -> Dict[str, Any]:
        source_fields = set()
        target_fields = set()
        
        try:
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                # Look for assignments: df['target'] = ...
                if isinstance(node, ast.Assign):
                    # Check targets (left side)
                    for target in node.targets:
                        if isinstance(target, ast.Subscript):
                            # Ensure it's a string index: df['col']
                            if isinstance(target.slice, ast.Constant) and isinstance(target.slice.value, str):
                                target_fields.add(target.slice.value)
                                
                    # Check value (right side) for source dependencies
                    # We walk the value node to find any Subscripts on the right side
                    for child in ast.walk(node.value):
                        if isinstance(child, ast.Subscript):
                            if isinstance(child.slice, ast.Constant) and isinstance(child.slice.value, str):
                                source_fields.add(child.slice.value)
                                
        except Exception as e:
            logger.warning(f"Failed to parse python code for lineage: {e}")
            
        return {
            "source_fields": list(source_fields),
            "target_fields": list(target_fields)
        }


logger = logging.getLogger(__name__)


class LineageService:
    """
    Service for building and querying the data lineage graph.
    
    The lineage graph consists of:
    - Nodes: Connectors, Reports, MappingSets
    - Edges: Data flow relationships between nodes
    """
    
    @staticmethod
    def get_or_create_node(
        db: Session,
        tenant_id: UUID,
        node_type: models.LineageNodeType,
        entity_id: UUID,
        name: str,
        description: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> models.LineageNode:
        """Get existing node or create new one for an entity."""
        node = db.query(models.LineageNode).filter(
            and_(
                models.LineageNode.tenant_id == tenant_id,
                models.LineageNode.entity_id == entity_id
            )
        ).first()
        
        if node:
            # Update name/metadata if changed
            node.name = name
            if description:
                node.description = description
            if metadata:
                node.node_metadata = metadata
        else:
            node = models.LineageNode(
                tenant_id=tenant_id,
                node_type=node_type,
                entity_id=entity_id,
                name=name,
                description=description,
                node_metadata=metadata or {}
            )
            db.add(node)
            db.flush()
        
        return node
    
    @staticmethod
    def create_edge(
        db: Session,
        tenant_id: UUID,
        source_node_id: UUID,
        target_node_id: UUID,
        relationship_type: models.LineageRelationshipType,
        label: Optional[str] = None,
        source_fields: Optional[List[str]] = None,
        target_fields: Optional[List[str]] = None,
        transformation: Optional[str] = None
    ) -> models.LineageEdge:
        """Create an edge between two nodes (or update if exists)."""
        # Check if edge already exists
        edge = db.query(models.LineageEdge).filter(
            and_(
                models.LineageEdge.source_node_id == source_node_id,
                models.LineageEdge.target_node_id == target_node_id,
                models.LineageEdge.relationship_type == relationship_type
            )
        ).first()
        
        if edge:
            # Update existing edge
            if label:
                edge.label = label
            if source_fields:
                edge.source_fields = source_fields
            if target_fields:
                edge.target_fields = target_fields
            if transformation:
                edge.transformation = transformation
        else:
            edge = models.LineageEdge(
                tenant_id=tenant_id,
                source_node_id=source_node_id,
                target_node_id=target_node_id,
                relationship_type=relationship_type,
                label=label,
                source_fields=source_fields,
                target_fields=target_fields,
                transformation=transformation
            )
            db.add(edge)
            db.flush()
        
        return edge
    
    @staticmethod
    def build_lineage_for_report(
        db: Session,
        report_id: UUID,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Build/rebuild lineage for a specific report.
        
        Called automatically when a report version is saved.
        Scans the report configuration to find:
        - Connected database connector
        - Referenced mapping sets (from python code analysis - future)
        """
        logger.info(f"Building lineage for report {report_id}")
        
        # Get report
        report = db.query(models.Report).filter(
            models.Report.id == report_id
        ).first()
        
        if not report:
            logger.warning(f"Report {report_id} not found")
            return {"error": "Report not found"}
        
        # Create/update report node
        report_node = LineageService.get_or_create_node(
            db=db,
            tenant_id=tenant_id,
            node_type=models.LineageNodeType.REPORT,
            entity_id=report_id,
            name=report.name,
            description=report.description,
            metadata={
                "is_active": report.is_active,
                "current_version_id": str(report.current_version_id) if report.current_version_id else None
            }
        )
        
        # Get current version to find connector
        if report.current_version_id:
            version = db.query(models.ReportVersion).filter(
                models.ReportVersion.id == report.current_version_id
            ).first()
            
            if version and version.connector_id:
                # Get connector
                connector = db.query(models.Connector).filter(
                    models.Connector.id == version.connector_id
                ).first()
                
                if connector:
                    # Create/update connector node
                    connector_node = LineageService.get_or_create_node(
                        db=db,
                        tenant_id=tenant_id,
                        node_type=models.LineageNodeType.CONNECTOR,
                        entity_id=connector.id,
                        name=connector.name,
                        description=connector.description,
                        metadata={
                            "db_type": connector.type.value,
                            "host": connector.config.get("host", ""),
                            "database": connector.config.get("database", "")
                        }
                    )
                    
                    # Extract field level lineage if available
                    source_fields = []
                    target_fields = []
                    transformation_desc = None
                    
                    if version.config and "field_mappings" in version.config:
                        mappings = version.config["field_mappings"]
                        # Extract non-empty source columns and unique target XPaths
                        source_fields = list(set([m.get("sourceColumn") for m in mappings if m.get("sourceColumn")]))
                        target_fields = list(set([m.get("targetXPath") for m in mappings if m.get("targetXPath")]))
                        transformation_desc = f"Mapped {len(mappings)} fields via simple config"
                    elif version.python_code:
                        # Advanced Mode: Parse Python code
                        lineage_data = PythonLineageParser.parse(version.python_code)
                        source_fields = lineage_data["source_fields"]
                        target_fields = lineage_data["target_fields"]
                        if source_fields or target_fields:
                            transformation_desc = "Extracted from Python code analysis"
                    
                    # Create edge: Connector → Report
                    LineageService.create_edge(
                        db=db,
                        tenant_id=tenant_id,
                        source_node_id=connector_node.id,
                        target_node_id=report_node.id,
                        relationship_type=models.LineageRelationshipType.PROVIDES_DATA,
                        label="provides data",
                        source_fields=source_fields,
                        target_fields=target_fields,
                        transformation=transformation_desc
                    )
                    
                    logger.info(f"Created lineage edge: {connector.name} → {report.name}")
        
        # Phase 2: Parse python_code to find mapping references
        if report.current_version_id:
            version = db.query(models.ReportVersion).filter(
                models.ReportVersion.id == report.current_version_id
            ).first()
            
            if version and version.python_code:
                # Naive heuristic: Search for mapping names or IDs in the code
                # Get all mapping sets for tenant
                mappings = db.query(models.MappingSet).filter(
                    models.MappingSet.tenant_id == tenant_id
                ).all()
                
                for mapping in mappings:
                    # Check if mapping name or ID appears in the code
                    # (Case insensitive search for name)
                    if (str(mapping.id) in version.python_code) or \
                       (re.search(re.escape(mapping.name), version.python_code, re.IGNORECASE)):
                        
                        # Create/update mapping node
                        mapping_node = LineageService.get_or_create_node(
                            db=db,
                            tenant_id=tenant_id,
                            node_type=models.LineageNodeType.MAPPING_SET,
                            entity_id=mapping.id,
                            name=mapping.name,
                            description=mapping.description,
                            metadata={"entry_count": 0} # TODO: Count entries if needed
                        )
                        
                        # Create edge: MappingSet → Report
                        LineageService.create_edge(
                            db=db,
                            tenant_id=tenant_id,
                            source_node_id=mapping_node.id,
                            target_node_id=report_node.id,
                            relationship_type=models.LineageRelationshipType.USES_MAPPING,
                            label="uses mapping"
                        )
                        logger.info(f"Created lineage edge: {mapping.name} → {report.name}")

        # Phase 2: Add destination nodes
        destinations = db.query(models.Destination).join(
            models.ReportDestination,
            models.ReportDestination.destination_id == models.Destination.id
        ).filter(
            models.ReportDestination.report_id == report_id
        ).all()
        
        for dest in destinations:
            # Create/update destination node
            dest_node = LineageService.get_or_create_node(
                db=db,
                tenant_id=tenant_id,
                node_type=models.LineageNodeType.DESTINATION,
                entity_id=dest.id,
                name=dest.name,
                description=dest.description,
                metadata={
                    "protocol": dest.protocol.value,
                    "is_active": dest.is_active
                }
            )
            
            # Create edge: Report → Destination
            LineageService.create_edge(
                db=db,
                tenant_id=tenant_id,
                source_node_id=report_node.id,
                target_node_id=dest_node.id,
                relationship_type=models.LineageRelationshipType.DELIVERS_TO,
                label="delivers to"
            )
            logger.info(f"Created lineage edge: {report.name} → {dest.name}")
        
        db.commit()
        
        return {
            "report_node_id": str(report_node.id),
            "edges_created": 1 if report.current_version_id else 0
        }
    
    @staticmethod
    def build_lineage_for_tenant(
        db: Session,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Rebuild entire lineage graph for a tenant.
        
        Scans all reports and their configurations to rebuild the graph.
        """
        logger.info(f"Rebuilding full lineage for tenant {tenant_id}")
        
        # First, clear existing lineage for this tenant
        db.query(models.LineageEdge).filter(
            models.LineageEdge.tenant_id == tenant_id
        ).delete()
        db.query(models.LineageNode).filter(
            models.LineageNode.tenant_id == tenant_id
        ).delete()
        db.flush()
        
        # Get all reports
        reports = db.query(models.Report).filter(
            models.Report.tenant_id == tenant_id
        ).all()
        
        stats = {
            "reports_processed": 0,
            "nodes_created": 0,
            "edges_created": 0
        }
        
        for report in reports:
            result = LineageService.build_lineage_for_report(db, report.id, tenant_id)
            stats["reports_processed"] += 1
            stats["edges_created"] += result.get("edges_created", 0)
        
        # Count nodes
        stats["nodes_created"] = db.query(models.LineageNode).filter(
            models.LineageNode.tenant_id == tenant_id
        ).count()
        
        logger.info(f"Lineage rebuild complete: {stats}")
        return stats
    
    @staticmethod
    def get_lineage_graph(
        db: Session,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Get the lineage graph for visualization.
        
        Returns nodes and edges in a format suitable for React Flow.
        """
        nodes = db.query(models.LineageNode).filter(
            models.LineageNode.tenant_id == tenant_id
        ).all()
        
        edges = db.query(models.LineageEdge).filter(
            models.LineageEdge.tenant_id == tenant_id
        ).all()
        
        # Format for React Flow
        return {
            "nodes": [
                {
                    "id": str(node.id),
                    "type": node.node_type.value,
                    "data": {
                        "label": node.name,
                        "entityId": str(node.entity_id),
                        "description": node.description,
                        "metadata": node.node_metadata
                    },
                    "position": {
                        "x": node.position_x or 0,
                        "y": node.position_y or 0
                    }
                }
                for node in nodes
            ],
            "edges": [
                {
                    "id": str(edge.id),
                    "source": str(edge.source_node_id),
                    "target": str(edge.target_node_id),
                    "type": "smoothstep",
                    "animated": True,
                    "label": edge.label,
                    "data": {
                        "relationshipType": edge.relationship_type.value,
                        "sourceFields": edge.source_fields,
                        "targetFields": edge.target_fields,
                        "transformation": edge.transformation
                    }
                }
                for edge in edges
            ]
        }
    
    @staticmethod
    def get_report_lineage(
        db: Session,
        report_id: UUID,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """
        Get upstream and downstream lineage for a specific report.
        """
        # Find the report node
        report_node = db.query(models.LineageNode).filter(
            and_(
                models.LineageNode.tenant_id == tenant_id,
                models.LineageNode.entity_id == report_id,
                models.LineageNode.node_type == models.LineageNodeType.REPORT
            )
        ).first()
        
        if not report_node:
            return {"upstream": [], "downstream": [], "error": "Report not in lineage graph"}
        
        # Get upstream (incoming edges)
        upstream_edges = db.query(models.LineageEdge).filter(
            models.LineageEdge.target_node_id == report_node.id
        ).all()
        
        upstream_nodes = []
        for edge in upstream_edges:
            source = db.query(models.LineageNode).filter(
                models.LineageNode.id == edge.source_node_id
            ).first()
            if source:
                upstream_nodes.append({
                    "id": str(source.id),
                    "type": source.node_type.value,
                    "name": source.name,
                    "entityId": str(source.entity_id),
                    "relationship": edge.relationship_type.value,
                    "data": {
                        "relationshipType": edge.relationship_type.value,
                        "sourceFields": edge.source_fields,
                        "targetFields": edge.target_fields,
                        "transformation": edge.transformation
                    }
                })
        
        # Get downstream (outgoing edges)
        downstream_edges = db.query(models.LineageEdge).filter(
            models.LineageEdge.source_node_id == report_node.id
        ).all()
        
        downstream_nodes = []
        for edge in downstream_edges:
            target = db.query(models.LineageNode).filter(
                models.LineageNode.id == edge.target_node_id
            ).first()
            if target:
                downstream_nodes.append({
                    "id": str(target.id),
                    "type": target.node_type.value,
                    "name": target.name,
                    "entityId": str(target.entity_id),
                    "relationship": edge.relationship_type.value,
                    "data": {
                        "relationshipType": edge.relationship_type.value,
                        "sourceFields": edge.source_fields,
                        "targetFields": edge.target_fields,
                        "transformation": edge.transformation
                    }
                })
        
        return {
            "report": {
                "id": str(report_node.id),
                "name": report_node.name
            },
            "upstream": upstream_nodes,
            "downstream": downstream_nodes
        }
