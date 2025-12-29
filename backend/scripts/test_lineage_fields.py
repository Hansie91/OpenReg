
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

def test_field_level_lineage():
    print("Testing Field-Level Lineage Extraction...")
    db = SessionLocal()
    
    try:
        # 1. Setup Tenant and User
        tenant = db.query(models.Tenant).filter(models.Tenant.slug == "field-test").first()
        if not tenant:
            tenant = models.Tenant(name="Field Level Test", slug="field-test")
            db.add(tenant)
            db.flush()
        
        user = db.query(models.User).filter(models.User.email == "field@test.com").first()
        if not user:
            user = models.User(
                tenant_id=tenant.id,
                email="field@test.com",
                hashed_password=hash_password("test"),
                full_name="Field Tester"
            )
            db.add(user)
            db.flush()

        # 2. Create Connector
        connector = models.Connector(
            tenant_id=tenant.id,
            name="Sales Database",
            type=models.ConnectorType.POSTGRESQL,
            config={"host": "localhost", "database": "sales_db"}
        )
        db.add(connector)
        db.flush()
        print(f"Created Connector: {connector.name}")

        # 3. Create Simple Mode Report with Field Mappings
        report = models.Report(
            tenant_id=tenant.id,
            name="Sales XML Report",
            is_active=True,
            created_by=user.id
        )
        db.add(report)
        db.flush()

        # Define Field Mappings
        field_mappings = [
            {"sourceColumn": "txn_id", "targetXPath": "/Document/Txn/Id"},
            {"sourceColumn": "amount", "targetXPath": "/Document/Txn/Amt"},
            {"sourceColumn": "currency", "targetXPath": "/Document/Txn/Ccy"},
            {"sourceColumn": "cust_id", "targetXPath": "/Document/Cust/Id"}, # 2 fields from same table
            {"sourceColumn": "", "targetXPath": "/Document/Header/Date", "defaultValue": "2024-01-01"}, # Check fallback
        ]

        report_version = models.ReportVersion(
            report_id=report.id,
            version_number=1,
            connector_id=connector.id,
            python_code="", # No code, simple mode
            config={"field_mappings": field_mappings},
            status=models.ReportVersionStatus.ACTIVE,
            created_by=user.id
        )
        db.add(report_version)
        db.flush()
        report.current_version_id = report_version.id
        db.commit()
        print(f"Created Report with {len(field_mappings)} field mappings")

        # 4. Run Lineage Build
        print("Building Lineage...")
        LineageService.build_lineage_for_report(db, report.id, tenant.id)

        # 5. Verify Edge Metadata
        connector_node = db.query(models.LineageNode).filter(
            models.LineageNode.tenant_id == tenant.id,
            models.LineageNode.entity_id == connector.id
        ).first()
        
        report_node = db.query(models.LineageNode).filter(
            models.LineageNode.tenant_id == tenant.id,
            models.LineageNode.entity_id == report.id
        ).first()
        
        if not connector_node or not report_node:
            print("❌ Failed to find nodes")
            return

        edge = db.query(models.LineageEdge).filter(
            models.LineageEdge.source_node_id == connector_node.id,
            models.LineageEdge.target_node_id == report_node.id
        ).first()
        
        if not edge:
            print("❌ Failed to find edge")
            return

        print("\nVerifying Edge Details:")
        print(f" - Transformation: {edge.transformation}")
        print(f" - Source Fields: {edge.source_fields}")
        print(f" - Target Fields: {edge.target_fields}")

        # Assertions
        expected_sources = ["txn_id", "amount", "currency", "cust_id"]
        missing_sources = [s for s in expected_sources if s not in (edge.source_fields or [])]
        
        if not missing_sources and "amount" in edge.source_fields:
             print("✅ Source fields verification PASSED")
        else:
             print(f"❌ Source fields verification FAILED. Missing: {missing_sources}")

        if "/Document/Txn/Amt" in (edge.target_fields or []):
             print("✅ Target fields verification PASSED")
        else:
             print("❌ Target fields verification FAILED")

    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # db.close() 
        pass

if __name__ == "__main__":
    test_field_level_lineage()
