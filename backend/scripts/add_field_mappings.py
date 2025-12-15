"""
Script to add field_mappings to an existing Advanced Mode report
This enables hierarchical XML generation
"""

import sys
import os
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import SessionLocal
import models
import json

# MiFIR field mappings based on the schema
MIFIR_FIELD_MAPPINGS = [
    {"sourceColumn": "transaction_ref", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/TxId", "transform": ""},
    {"sourceColumn": "executing_entity_lei", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/ExctgPty", "transform": "UPPER"},
    {"sourceColumn": "submitting_entity_lei", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/SubmitgPty", "transform": "UPPER"},
    {"sourceColumn": "buyer_lei", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/Buyr/Acct/Id/LEI", "transform": "UPPER"},
    {"sourceColumn": "seller_lei", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/Sellr/Acct/Id/LEI", "transform": "UPPER"},
    {"sourceColumn": "instrument_isin", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/FinInstrm/Id", "transform": "UPPER"},
    {"sourceColumn": "quantity", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/Qty/Unit", "transform": "DECIMAL_2"},
    {"sourceColumn": "price", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/Pric/Pric/MntryVal/Amt", "transform": "DECIMAL_4"},
    {"sourceColumn": "currency", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/Pric/Pric/MntryVal/Ccy", "transform": "UPPER"},
    {"sourceColumn": "trade_date", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/TradDt", "transform": "DATE_ISO"},
    {"sourceColumn": "venue_mic", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/TradVn", "transform": "UPPER"},
    {"sourceColumn": "country_code", "targetXPath": "/Document/FinInstrmRptgTxRpt/Tx/New/CtryOfBrnch", "transform": "UPPER"},
]

def add_field_mappings(report_name: str = "MiFIR"):
    db = SessionLocal()
    try:
        # Find the report
        report = db.query(models.Report).filter(
            models.Report.name.ilike(f"%{report_name}%")
        ).first()
        
        if not report:
            print(f"❌ Report '{report_name}' not found")
            return
        
        print(f"📋 Found report: {report.name} (ID: {report.id})")
        
        if not report.current_version_id:
            print("❌ No current version set!")
            return
        
        # Get current version
        version = db.query(models.ReportVersion).filter(
            models.ReportVersion.id == report.current_version_id
        ).first()
        
        if not version:
            print("❌ Version not found!")
            return
        
        print(f"📌 Current version: v{version.major_version}.{version.minor_version}")
        
        # Update config with field_mappings
        config = version.config or {}
        config['field_mappings'] = MIFIR_FIELD_MAPPINGS
        config['namespace'] = 'urn:iso:std:iso:20022:tech:xsd:auth.016.001.01'
        
        version.config = config
        db.commit()
        
        print(f"\n✅ Added {len(MIFIR_FIELD_MAPPINGS)} field mappings to config!")
        print("\nField mappings added:")
        for m in MIFIR_FIELD_MAPPINGS:
            print(f"   {m['sourceColumn']} -> {m['targetXPath']}")
        
        print("\n🔄 Please restart the worker and re-run the report!")
        
    finally:
        db.close()

if __name__ == "__main__":
    report_name = sys.argv[1] if len(sys.argv) > 1 else "MiFIR"
    add_field_mappings(report_name)
