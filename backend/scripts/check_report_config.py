"""
Script to verify report configurations have proper field_mappings with targetXPath
"""

import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import SessionLocal
import models
import json

def check_report_configs():
    db = SessionLocal()
    try:
        # Get all reports with their current versions
        reports = db.query(models.Report).all()
        
        print(f"\n{'='*60}")
        print(f"Found {len(reports)} report(s)")
        print(f"{'='*60}\n")
        
        for report in reports:
            print(f"📋 Report: {report.name}")
            print(f"   ID: {report.id}")
            print(f"   Active: {report.is_active}")
            
            if report.current_version_id:
                version = db.query(models.ReportVersion).filter(
                    models.ReportVersion.id == report.current_version_id
                ).first()
                
                if version:
                    print(f"   Current Version: v{version.major_version}.{version.minor_version}")
                    print(f"   Connector ID: {version.connector_id}")
                    
                    config = version.config or {}
                    print(f"\n   Config keys: {list(config.keys())}")
                    
                    # Check for field_mappings
                    field_mappings = config.get('field_mappings', [])
                    print(f"\n   📌 field_mappings: {len(field_mappings)} mapping(s)")
                    
                    if field_mappings:
                        for i, mapping in enumerate(field_mappings[:5]):  # Show first 5
                            source = mapping.get('sourceColumn', '(none)')
                            target = mapping.get('targetXPath', '(none)')
                            transform = mapping.get('transform', '')
                            default = mapping.get('defaultValue', '')
                            print(f"      [{i+1}] {source} -> {target}")
                            if transform:
                                print(f"          transform: {transform}")
                            if default:
                                print(f"          default: {default}")
                        
                        if len(field_mappings) > 5:
                            print(f"      ... and {len(field_mappings) - 5} more")
                        
                        # Check if mappings have targetXPath
                        with_xpath = sum(1 for m in field_mappings if m.get('targetXPath'))
                        print(f"\n   ✅ Mappings with targetXPath: {with_xpath}/{len(field_mappings)}")
                    else:
                        print("   ⚠️  No field_mappings found in config!")
                        print("      This report will generate FLAT XML structure.")
                    
                    # Check output format
                    output_format = config.get('output_format') or config.get('output_formats', 'csv')
                    print(f"\n   📄 Output format: {output_format}")
                    
                    # Check mode
                    mode = config.get('mode', 'advanced')
                    print(f"   🔧 Mode: {mode}")
                    
                    # Check namespace
                    namespace = config.get('namespace')
                    if namespace:
                        print(f"   🏷️  Namespace: {namespace}")
                else:
                    print("   ⚠️  Version not found!")
            else:
                print("   ⚠️  No current version set!")
            
            print(f"\n{'-'*60}\n")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_report_configs()
