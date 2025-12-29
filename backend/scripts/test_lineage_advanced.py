
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

def test_advanced_lineage():
    print("Testing Advanced Lineage Parsing (AST)...")
    db = SessionLocal()
    
    try:
        # 1. Setup Tenant and User
        tenant = db.query(models.Tenant).filter(models.Tenant.slug == "ast-test").first()
        if not tenant:
            tenant = models.Tenant(name="AST Parsing Test", slug="ast-test")
            db.add(tenant)
            db.flush()
        
        user = db.query(models.User).filter(models.User.email == "ast@test.com").first()
        if not user:
            user = models.User(
                tenant_id=tenant.id,
                email="ast@test.com",
                hashed_password=hash_password("test"),
                full_name="AST Tester"
            )
            db.add(user)
            db.flush()

        # 2. Create Connector
        connector = models.Connector(
            tenant_id=tenant.id,
            name="Data Lake",
            type=models.ConnectorType.POSTGRESQL,
            config={"host": "datalake.internal", "database": "raw"}
        )
        db.add(connector)
        db.flush()
        print(f"Created Connector: {connector.name}")

        # 3. Create Report with Python Code
        report = models.Report(
            tenant_id=tenant.id,
            name="Complex Python Report",
            is_active=True,
            created_by=user.id
        )
        db.add(report)
        db.flush()

        # Python code simulating transformations
        python_code = """
def transform(db, mappings, params):
    # Fetch source data
    df = db.query("SELECT * FROM transactions")
    
    # Simple assignment
    df['xml_txn_id'] = df['transaction_id']
    
    # Operation assignment
    df['net_amount'] = df['gross_amount'] - df['tax_amount']
    
    # Using Subscript in calculation
    df['final_score'] = df['risk_score'] * 1.5
    
    return df
"""

        report_version = models.ReportVersion(
            report_id=report.id,
            version_number=1,
            connector_id=connector.id,
            python_code=python_code,
            config={}, # No simple config
            status=models.ReportVersionStatus.ACTIVE,
            created_by=user.id
        )
        db.add(report_version)
        db.flush()
        report.current_version_id = report_version.id
        db.commit()
        print(f"Created Report with Python code")

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
        expected_sources = ['transaction_id', 'gross_amount', 'tax_amount', 'risk_score']
        expected_targets = ['xml_txn_id', 'net_amount', 'final_score']
        
        # Check all expected sources are present
        missing_sources = [s for s in expected_sources if s not in (edge.source_fields or [])]
        
        if not missing_sources:
             print("✅ Source fields verification PASSED")
        else:
             print(f"❌ Source fields verification FAILED. Missing: {missing_sources}")

        missing_targets = [t for t in expected_targets if t not in (edge.target_fields or [])]
        if not missing_targets:
             print("✅ Target fields verification PASSED")
        else:
             print(f"❌ Target fields verification FAILED. Missing: {missing_targets}")

    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        pass

if __name__ == "__main__":
    test_advanced_lineage()
