
import sys
import os
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, Base, engine
import models
from services.lineage import LineageService
from services.auth import hash_password

def test_lineage_expansion():
    print("Testing Lineage Expansion...")
    db = SessionLocal()
    
    try:
        # 1. Setup Tenant and User
        tenant = db.query(models.Tenant).filter(models.Tenant.slug == "lineage-test").first()
        if not tenant:
            tenant = models.Tenant(name="Lineage Test", slug="lineage-test")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        
        user = db.query(models.User).filter(models.User.email == "lineage@test.com").first()
        if not user:
            user = models.User(
                tenant_id=tenant.id,
                email="lineage@test.com",
                hashed_password=hash_password("test"),
                full_name="Lineage Tester"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 2. Create Mapping Set
        mapping = models.MappingSet(
            tenant_id=tenant.id,
            name="Test Mapping Set",
            description="A mapping set for testing lineage"
        )
        db.add(mapping)
        db.commit()
        db.refresh(mapping)
        print(f"Created MappingSet: {mapping.name} ({mapping.id})")

        # 3. Create Destination
        destination = models.Destination(
            tenant_id=tenant.id,
            name="SFTP Dropzone",
            protocol=models.DeliveryProtocol.SFTP,
            config={"host": "sftp.example.com"}
        )
        db.add(destination)
        db.commit()
        db.refresh(destination)
        print(f"Created Destination: {destination.name} ({destination.id})")

        # 4. Create Report with Mapping Reference in Code
        report = models.Report(
            tenant_id=tenant.id,
            name="Lineage Report V2",
            is_active=True,
            created_by=user.id
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        report_version = models.ReportVersion(
            report_id=report.id,
            version_number=1,
            # Reference the mapping by name in the code
            python_code=f"# This report uses mappings\nmapping = get_mapping('{mapping.name}')\nresults = process(mapping)",
            status=models.ReportVersionStatus.ACTIVE,
            created_by=user.id
        )
        db.add(report_version)
        db.commit()
        report.current_version_id = report_version.id
        db.commit()
        print(f"Created Report: {report.name} with code referencing mapping")

        # 5. Link Report to Destination
        report_dest = models.ReportDestination(
            report_id=report.id,
            destination_id=destination.id
        )
        db.add(report_dest)
        db.commit()
        print("Linked Report to Destination")

        # 6. Run Lineage Build
        print("Building Lineage...")
        LineageService.build_lineage_for_report(db, report.id, tenant.id)

        # 7. Verify Nodes and Edges
        nodes = db.query(models.LineageNode).filter(models.LineageNode.tenant_id == tenant.id).all()
        edges = db.query(models.LineageEdge).filter(models.LineageEdge.tenant_id == tenant.id).all()
        
        print(f"\nTotal Nodes: {len(nodes)}")
        for node in nodes:
            print(f" - [{node.node_type.value}] {node.name}")
            
        print(f"\nTotal Edges: {len(edges)}")
        for edge in edges:
            print(f" - {edge.relationship_type.value}: {edge.source_node.name} -> {edge.target_node.name}")

        # Assertions
        mapping_node = next((n for n in nodes if n.node_type == models.LineageNodeType.MAPPING_SET and n.entity_id == mapping.id), None)
        dest_node = next((n for n in nodes if n.node_type == models.LineageNodeType.DESTINATION and n.entity_id == destination.id), None)
        report_node = next((n for n in nodes if n.node_type == models.LineageNodeType.REPORT and n.entity_id == report.id), None)

        if mapping_node and dest_node and report_node:
            print("\n✅ Verification SUCCESS: All nodes created.")
        else:
            print("\n❌ Verification FAILED: Missing nodes.")
            # db.close()
            # return

        mapping_edge = next((e for e in edges if e.source_node_id == mapping_node.id and e.target_node_id == report_node.id), None)
        dest_edge = next((e for e in edges if e.source_node_id == report_node.id and e.target_node_id == dest_node.id), None)

        if mapping_edge and dest_edge:
             print("✅ Verification SUCCESS: All edges created.")
        else:
             print("❌ Verification FAILED: Missing edges.")

    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        # db.close() 
        pass

if __name__ == "__main__":
    test_lineage_expansion()
