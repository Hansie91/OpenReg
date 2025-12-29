
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

def create_full_mifir_report():
    print("Creating Full MiFIR Report Demo...")
    db = SessionLocal()
    
    try:
        # 1. Setup Tenant and User
        # Use first available tenant to ensure visibility for existing user
        tenant = db.query(models.Tenant).first()
        if not tenant:
            tenant = models.Tenant(name="Default Tenant", slug="default")
            db.add(tenant)
            db.flush()
        
        # Use existing admin user if possible, otherwise find any user
        user = db.query(models.User).filter(models.User.email == "admin@example.com").first()
        if not user:
            user = db.query(models.User).filter(models.User.tenant_id == tenant.id).first()
        if not user:
             user = models.User(
                tenant_id=tenant.id,
                email="admin@example.com",
                hashed_password=hash_password("admin123"),
                full_name="Admin User"
            )
             db.add(user)
             db.flush()

        # 2. Create Connector (referencing the internal DB where mifir_transactions lives)
        connector = db.query(models.Connector).filter(
            models.Connector.tenant_id == tenant.id,
            models.Connector.name == "Production DB"
        ).first()
        
        if not connector:
            connector = models.Connector(
                tenant_id=tenant.id,
                name="Production DB",
                type=models.ConnectorType.POSTGRESQL,
                config={"host": "postgres", "database": "openreg"}
            )
            db.add(connector)
            db.flush()
        
        print(f"Using Connector: {connector.name}")

        # 3. Create Report
        report_name = "MiFIR 65-Field Demo"
        report = db.query(models.Report).filter(
            models.Report.tenant_id == tenant.id,
            models.Report.name == report_name
        ).first()
        
        if not report:
            report = models.Report(
                tenant_id=tenant.id,
                name=report_name,
                description="A full demonstration of data lineage with 65+ field mappings",
                is_active=True,
                created_by=user.id
            )
            db.add(report)
            db.flush()
        
        print(f"Report: {report.name} (ID: {report.id})")

        # 4. Define Python Transformation Code
        # Mapping aligned with ISO 20022 / MiFIR RTS 22
        python_code = """
def transform(db, mappings, params):
    # Fetch validated transactions
    df = db.query("SELECT * FROM mifir_transactions WHERE status = 'validated'")
    
    # --- Transaction Identification ---
    df['Tx.Id'] = df['transaction_reference']
    df['Tx.ExctgPty'] = df['executing_entity_lei']
    df['Tx.SubmitgPty'] = df['submitting_entity_lei']
    
    # --- Investment & Execution Decisions ---
    df['Tx.InvstmtDcsnPrsn.Prsn.Id'] = df['investment_decision_person_code']
    df['Tx.InvstmtDcsnPrsn.Algo.Id'] = df['investment_decision_within_firm']
    df['Tx.ExctgPrsn.Prsn.Id'] = df['execution_person_code']
    df['Tx.ExctgPrsn.Algo.Id'] = df['execution_within_firm']
    
    # --- Buyer ---
    df['Tx.Buyr.AcctOwnr.Id.LEI'] = df['buyer_lei']
    df['Tx.Buyr.AcctOwnr.Id.NtlRegnNb'] = df['buyer_decision_maker_code']
    df['Tx.Buyr.AcctOwnr.Id.Prsn.FrstNm'] = df['buyer_first_name']
    df['Tx.Buyr.AcctOwnr.Id.Prsn.Nm'] = df['buyer_surname']
    df['Tx.Buyr.AcctOwnr.Id.Prsn.BirthDt'] = df['buyer_date_of_birth']
    df['Tx.Buyr.AcctOwnr.Id.Prsn.Ctry'] = df['buyer_country']
    
    # --- Seller ---
    df['Tx.Sellr.AcctOwnr.Id.LEI'] = df['seller_lei']
    df['Tx.Sellr.AcctOwnr.Id.NtlRegnNb'] = df['seller_decision_maker_code']
    df['Tx.Sellr.AcctOwnr.Id.Prsn.FrstNm'] = df['seller_first_name']
    df['Tx.Sellr.AcctOwnr.Id.Prsn.Nm'] = df['seller_surname']
    df['Tx.Sellr.AcctOwnr.Id.Prsn.BirthDt'] = df['seller_date_of_birth']
    df['Tx.Sellr.AcctOwnr.Id.Prsn.Ctry'] = df['seller_country']
    
    # --- Transmission ---
    df['Tx.TrnsmssnInd'] = df['transmission_indicator']
    df['Tx.TrnsmttgFirm.LEI'] = df['transmitting_firm_lei']
    
    # --- Trading Details ---
    df['Tx.TradDt'] = df['trading_date_time']
    df['Tx.TradgCpcty'] = df['trading_capacity']
    df['Tx.Qty.Unit'] = df['quantity']
    df['Tx.Qty.Ccy'] = df['quantity_currency']
    df['Tx.Pric.Amt'] = df['price']
    df['Tx.Pric.Ccy'] = df['price_currency']
    df['Tx.NetAmt'] = df['net_amount']
    df['Tx.Venue'] = df['venue_mic']
    df['Tx.CtryOfBrnch'] = df['country_of_branch']
    df['Tx.UpFrntPmt'] = df['up_front_payment']
    df['Tx.UpFrntPmtCcy'] = df['up_front_payment_currency']
    df['Tx.CmplxTradId'] = df['complex_trade_id']
    
    # --- Financial Instrument ---
    df['FinInstrm.Id'] = df['instrument_isin']
    df['FinInstrm.FullNm'] = df['instrument_full_name']
    df['FinInstrm.ClssfctnTp'] = df['instrument_classification']
    
    # --- Short Selling & Waivers ---
    df['ShrtSellgInd'] = df['short_selling_indicator']
    df['OtcPostTradInd'] = df['otc_post_trade_indicator']
    df['CmdtyDrivInd'] = df['commodity_derivative_indicator']
    df['SctiesFincgInd'] = df['securities_financing_indicator']
    
    # --- Calculated / Derived (Example of deeper lineage) ---
    # Notional Amount = Price * Qty
    df['Calc.NotionalAmt'] = df['price'] * df['quantity'] 
    
    # Report Reference (concatenation)
    df['Rpt.Ref'] = df['transaction_reference'] + '-' + df['instrument_isin']
    
    return df
"""

        # 5. Create Report Version
        print("Creating Report Version...")
        version_number = 1
        if report.current_version_id:
            current_ver = db.query(models.ReportVersion).get(report.current_version_id)
            version_number = current_ver.version_number + 1
            
        version = models.ReportVersion(
            report_id=report.id,
            version_number=version_number,
            connector_id=connector.id,
            python_code=python_code,
            config={"output_format": "xml"},
            status=models.ReportVersionStatus.ACTIVE,
            created_by=user.id
        )
        db.add(version)
        db.flush()
        
        # Update Report current version
        report.current_version_id = version.id
        db.commit()
        print(f"Version {version.version_number} created.")

        # 6. Build Lineage
        print("Building Lineage...")
        result = LineageService.build_lineage_for_report(db, report.id, tenant.id)
        print(f"Lineage Build Result: {result}")

        # 7. Verify Results
        report_node = db.query(models.LineageNode).filter(
            models.LineageNode.entity_id == report.id,
            models.LineageNode.node_type == models.LineageNodeType.REPORT
        ).first()
        
        connector_node = db.query(models.LineageNode).filter(
            models.LineageNode.entity_id == connector.id,
            models.LineageNode.node_type == models.LineageNodeType.CONNECTOR
        ).first()
        
        edge = db.query(models.LineageEdge).filter(
            models.LineageEdge.source_node_id == connector_node.id,
            models.LineageEdge.target_node_id == report_node.id
        ).first()
        
        if edge:
            print(f"\n✅ Lineage Edge Verification Successful!")
            print(f"Edge ID: {edge.id}")
            source_count = len(edge.source_fields or [])
            target_count = len(edge.target_fields or [])
            print(f" - Source Fields Found: {source_count}")
            print(f" - Target Fields Found: {target_count}")
            
            if source_count > 30 and target_count > 30:
                print("✅ Successfully captured complex lineage mappings!")
            else:
                 print("⚠️ Warning: Field count lower than expected.")
                 print(f"Sources: {edge.source_fields}")
        else:
            print("❌ Lineage Edge NOT found.")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_full_mifir_report()
