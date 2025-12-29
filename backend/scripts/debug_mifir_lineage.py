
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models

def debug_lineage():
    print("Debugging Lineage for 'Mifir 11'...")
    db = SessionLocal()
    
    try:
        # 1. Find the Report
        # Search by name or partial name
        reports = db.query(models.Report).filter(models.Report.name.ilike("%Mifir%")).all()
        
        target_report = None
        for r in reports:
            print(f"\nFound Report: '{r.name}' (ID: {r.id})")
            print(f"  - Tenant ID: {r.tenant_id}")
            print(f"  - Current Version ID: {r.current_version_id}")
            
            if "Mifir 11" in r.name or "MiFIR 11" in r.name or r.name == "Mifir 11":
                target_report = r
        
        if not target_report:
            print("\n❌ Could not find exact match for 'Mifir 11'. check names above.")
            return

        print(f"\nAnalyzing Report: {target_report.name}")

        # 2. Check Report Version
        if not target_report.current_version_id:
            print("❌ Report has NO current version set. Lineage requires a current version.")
            return

        version = db.query(models.ReportVersion).get(target_report.current_version_id)
        if not version:
            print("❌ Current version ID points to non-existent version.")
            return
            
        print(f"  - Version: {version.version_number}")
        print(f"  - Connector ID: {version.connector_id}")
        
        if not version.connector_id:
            print("⚠️ Version has NO Connector ID linked. No edge will be created.")
        else:
             connector = db.query(models.Connector).get(version.connector_id)
             if connector:
                 print(f"  - Connector: {connector.name} (ID: {connector.id})")
             else:
                 print(f"❌ Connector ID {version.connector_id} not found in DB.")

        # 3. Check Lineage Nodes
        print("\nChecking Lineage Nodes:")
        report_node = db.query(models.LineageNode).filter(
            models.LineageNode.entity_id == target_report.id,
            models.LineageNode.node_type == models.LineageNodeType.REPORT
        ).first()
        
        if report_node:
             print(f"✅ Report Node found (ID: {report_node.id})")
        else:
             print("❌ Report Node NOT found.")
        
        connector_node = None
        if version.connector_id:
            connector_node = db.query(models.LineageNode).filter(
                models.LineageNode.entity_id == version.connector_id,
                models.LineageNode.node_type == models.LineageNodeType.CONNECTOR
            ).first()
            
            if connector_node:
                print(f"✅ Connector Node found (ID: {connector_node.id})")
            else:
                print("❌ Connector Node NOT found.")

        # 4. Check Lineage Edge
        if report_node and connector_node:
            print("\nChecking Lineage Edge:")
            edge = db.query(models.LineageEdge).filter(
                models.LineageEdge.source_node_id == connector_node.id,
                models.LineageEdge.target_node_id == report_node.id
            ).first()
            
            if edge:
                print(f"✅ Edge found (ID: {edge.id})")
                print(f" - Sources: {edge.source_fields}")
                print(f" - Targets: {edge.target_fields}")
            else:
                print("❌ Edge NOT found between Connector and Report nodes.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_lineage()
