"""
Demo Data Seed Script for OpenRegReport Portal

Creates sample data for new users to explore the platform immediately:
- Demo PostgreSQL connector (self-referencing)
- Demo transactions table with 25 MiFIR sample records
- Demo MiFIR report with transformation code
- Demo validation rules (5 rules)
- Demo schedule (daily at 6:00 AM)

This script is idempotent - safe to run multiple times.
"""

import sys
import os
from datetime import datetime, date, timedelta
from decimal import Decimal
import uuid
import random

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import SessionLocal, engine
from models import (
    Tenant, User, Connector, ConnectorType,
    Report, ReportVersion, ReportVersionStatus,
    ValidationRule, ValidationRuleType, ValidationSeverity,
    Schedule, ScheduleType,
    JobRun, JobRunStatus, TriggeredBy, Artifact
)
from services.auth import hash_password


# Sample LEI codes (Legal Entity Identifiers - 20 chars)
SAMPLE_LEIS = [
    "5493001KJTIIGC8Y1R12",
    "549300MLUDYVRQOOXS22",
    "529900W18LQJJN6SJ336",
    "5493008IUQYJRE346647",
    "549300EX04Q2QBFQTQ27",
    "213800KKNQVXFGWB4U84",
    "213800PBZLXW2AHTAO73",
    "549300NXYCWNF6VFKV74",
    "529900ODI3047E2LIV03",
    "5493006MHB84DD0ZWV18",
]

# Sample ISINs (International Securities ID - 12 chars)
SAMPLE_ISINS = [
    "GB00B0M62Q58",  # UK Equity
    "DE000BAY0017",  # German Equity
    "FR0000120271",  # French Equity
    "US0378331005",  # US Equity (Apple)
    "NL0000009165",  # Dutch Equity
    "CH0012032048",  # Swiss Equity
    "ES0113900J37",  # Spanish Equity
    "IT0000072618",  # Italian Equity
    "SE0000108656",  # Swedish Equity
    "DK0010274414",  # Danish Equity
]

# Sample MIC codes (Market Identifier Codes - 4 chars)
SAMPLE_MICS = ["XLON", "XPAR", "XETR", "XAMS", "XMAD", "XMIL", "XSTO", "XCSE", "XSWX", "XBRU"]

# Trading capacities
TRADING_CAPACITIES = ["DEAL", "MTCH", "AOTC", "PRIN"]

# Country codes
COUNTRY_CODES = ["GB", "DE", "FR", "NL", "ES", "IT", "SE", "DK", "CH", "BE"]


def generate_sample_transactions(count: int = 25) -> list[dict]:
    """Generate realistic sample MiFIR transaction data."""
    transactions = []
    base_date = datetime.now() - timedelta(days=1)

    for i in range(count):
        # Generate trading datetime with millisecond precision
        trade_time = base_date.replace(
            hour=random.randint(8, 17),
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
            microsecond=random.randint(0, 999) * 1000
        )

        quantity = random.randint(100, 10000)
        price = round(random.uniform(10.0, 500.0), 4)

        transaction = {
            "transaction_reference": f"TXN{base_date.strftime('%Y%m%d')}{str(i+1).zfill(6)}",
            "executing_entity_lei": random.choice(SAMPLE_LEIS),
            "submitting_entity_lei": random.choice(SAMPLE_LEIS),
            "investment_decision_within_firm": f"ALGO{random.randint(1000, 9999)}",
            "investment_decision_person_code": "",
            "execution_within_firm": f"ALGO{random.randint(1000, 9999)}",
            "execution_person_code": "",
            "buyer_lei": random.choice(SAMPLE_LEIS),
            "buyer_first_name": "",
            "buyer_surname": "",
            "buyer_date_of_birth": None,
            "buyer_country": random.choice(COUNTRY_CODES),
            "seller_lei": random.choice(SAMPLE_LEIS),
            "seller_first_name": "",
            "seller_surname": "",
            "seller_date_of_birth": None,
            "seller_country": random.choice(COUNTRY_CODES),
            "trading_date_time": trade_time.isoformat(),
            "trading_capacity": random.choice(TRADING_CAPACITIES),
            "quantity": quantity,
            "quantity_currency": "UNIT",
            "price": price,
            "price_currency": random.choice(["EUR", "GBP", "USD", "CHF"]),
            "net_amount": round(quantity * price, 2),
            "instrument_isin": random.choice(SAMPLE_ISINS),
            "instrument_full_name": f"Sample Security {i+1}",
            "instrument_classification": "ESNTPB",
            "venue_mic": random.choice(SAMPLE_MICS),
            "country_of_branch": random.choice(COUNTRY_CODES),
            "short_selling_indicator": random.choice(["SESH", "SSEX", "SELL", "UNDI"]),
            "transmission_indicator": random.choice([True, False]),
            "business_date": base_date.strftime("%Y-%m-%d"),
            "status": random.choice(["pending", "validated"]),
        }
        transactions.append(transaction)

    return transactions


def create_demo_transactions_table(db):
    """Create the mifir_demo_transactions table if it doesn't exist."""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS mifir_demo_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_reference VARCHAR(100) NOT NULL UNIQUE,
        executing_entity_lei VARCHAR(20),
        submitting_entity_lei VARCHAR(20),
        investment_decision_within_firm VARCHAR(50),
        investment_decision_person_code VARCHAR(50),
        execution_within_firm VARCHAR(50),
        execution_person_code VARCHAR(50),
        buyer_lei VARCHAR(20),
        buyer_first_name VARCHAR(100),
        buyer_surname VARCHAR(100),
        buyer_date_of_birth DATE,
        buyer_country VARCHAR(2),
        seller_lei VARCHAR(20),
        seller_first_name VARCHAR(100),
        seller_surname VARCHAR(100),
        seller_date_of_birth DATE,
        seller_country VARCHAR(2),
        trading_date_time TIMESTAMP WITH TIME ZONE,
        trading_capacity VARCHAR(4),
        quantity NUMERIC(18,4),
        quantity_currency VARCHAR(4),
        price NUMERIC(18,6),
        price_currency VARCHAR(3),
        net_amount NUMERIC(18,2),
        instrument_isin VARCHAR(12),
        instrument_full_name VARCHAR(350),
        instrument_classification VARCHAR(6),
        venue_mic VARCHAR(4),
        country_of_branch VARCHAR(2),
        short_selling_indicator VARCHAR(4),
        transmission_indicator BOOLEAN,
        business_date DATE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_mifir_demo_txn_business_date ON mifir_demo_transactions(business_date);
    CREATE INDEX IF NOT EXISTS idx_mifir_demo_txn_status ON mifir_demo_transactions(status);
    """
    db.execute(text(create_table_sql))
    db.commit()
    print("   Created mifir_demo_transactions table")


def insert_demo_transactions(db, transactions: list[dict]):
    """Insert sample transactions into the demo table."""
    # Check if data already exists
    count_result = db.execute(text("SELECT COUNT(*) FROM mifir_demo_transactions"))
    existing_count = count_result.scalar()

    if existing_count > 0:
        print(f"   Demo transactions already exist ({existing_count} records). Skipping insert.")
        return

    insert_sql = """
    INSERT INTO mifir_demo_transactions (
        transaction_reference, executing_entity_lei, submitting_entity_lei,
        investment_decision_within_firm, investment_decision_person_code,
        execution_within_firm, execution_person_code,
        buyer_lei, buyer_first_name, buyer_surname, buyer_date_of_birth, buyer_country,
        seller_lei, seller_first_name, seller_surname, seller_date_of_birth, seller_country,
        trading_date_time, trading_capacity, quantity, quantity_currency,
        price, price_currency, net_amount,
        instrument_isin, instrument_full_name, instrument_classification,
        venue_mic, country_of_branch, short_selling_indicator, transmission_indicator,
        business_date, status
    ) VALUES (
        :transaction_reference, :executing_entity_lei, :submitting_entity_lei,
        :investment_decision_within_firm, :investment_decision_person_code,
        :execution_within_firm, :execution_person_code,
        :buyer_lei, :buyer_first_name, :buyer_surname, :buyer_date_of_birth, :buyer_country,
        :seller_lei, :seller_first_name, :seller_surname, :seller_date_of_birth, :seller_country,
        :trading_date_time, :trading_capacity, :quantity, :quantity_currency,
        :price, :price_currency, :net_amount,
        :instrument_isin, :instrument_full_name, :instrument_classification,
        :venue_mic, :country_of_branch, :short_selling_indicator, :transmission_indicator,
        :business_date, :status
    )
    """

    for txn in transactions:
        db.execute(text(insert_sql), txn)

    db.commit()
    print(f"   Inserted {len(transactions)} demo transactions")


def create_demo_connector(db, tenant_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID:
    """Create a demo PostgreSQL connector pointing to the OpenReg database."""
    # Check if demo connector already exists
    existing = db.query(Connector).filter(
        Connector.tenant_id == tenant_id,
        Connector.name == "Demo PostgreSQL"
    ).first()

    if existing:
        print(f"   Demo connector already exists: {existing.id}")
        return existing.id

    connector = Connector(
        tenant_id=tenant_id,
        name="Demo PostgreSQL",
        description="Self-referencing connector to OpenReg database for demo purposes. Queries mifir_demo_transactions table.",
        type=ConnectorType.POSTGRESQL,
        config={
            "host": "postgres",
            "port": 5432,
            "database": "openreg"
        },
        # Note: credentials would normally be encrypted, but for demo we use env vars
        encrypted_credentials=None,
        is_active=True,
        created_by=user_id
    )
    db.add(connector)
    db.flush()
    print(f"   Created demo connector: {connector.id}")
    return connector.id


def create_demo_report(db, tenant_id: uuid.UUID, connector_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID:
    """Create a demo MiFIR report with transformation code."""
    # Check if demo report already exists
    existing = db.query(Report).filter(
        Report.tenant_id == tenant_id,
        Report.name == "MiFIR Daily Transaction Report"
    ).first()

    if existing:
        print(f"   Demo report already exists: {existing.id}")
        return existing.id

    report = Report(
        tenant_id=tenant_id,
        name="MiFIR Daily Transaction Report",
        description="Demo MiFIR RTS 25 transaction report. Generates XML output from mifir_demo_transactions table.",
        is_active=True,
        created_by=user_id
    )
    db.add(report)
    db.flush()

    # Create report version with Python transformation code
    python_code = '''def transform(db, mappings, params):
    """
    MiFIR RTS 25 Transaction Report Generator

    Transforms transaction data from mifir_demo_transactions table
    into MiFIR-compliant XML format.
    """
    import pandas as pd
    from datetime import datetime

    # Get business date from params or use yesterday
    business_date = params.get("business_date")
    if not business_date:
        business_date = (datetime.now() - pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    # Query demo transactions
    query = f"""
        SELECT * FROM mifir_demo_transactions
        WHERE business_date = '{business_date}'
        OR status IN ('pending', 'validated')
        ORDER BY trading_date_time
        LIMIT 500
    """
    df = db.query(query)

    if df.empty:
        # Fall back to all demo data if no specific date
        df = db.query("SELECT * FROM mifir_demo_transactions ORDER BY trading_date_time LIMIT 100")

    # Transform to MiFIR XML field names (ISO 20022 format)
    output = []
    for _, row in df.iterrows():
        record = {
            # Transaction Identification
            "TxId": row.get("transaction_reference", ""),
            "ExctgPty": row.get("executing_entity_lei", ""),
            "SubmitgPty": row.get("submitting_entity_lei", ""),

            # Investment Decision
            "InvstmtDcsnPrsn_Algo": row.get("investment_decision_within_firm", ""),
            "ExctgPrsn_Algo": row.get("execution_within_firm", ""),

            # Buyer
            "Buyr_LEI": row.get("buyer_lei", ""),
            "Buyr_Ctry": row.get("buyer_country", ""),

            # Seller
            "Sellr_LEI": row.get("seller_lei", ""),
            "Sellr_Ctry": row.get("seller_country", ""),

            # Trading Details
            "TradDtTm": str(row.get("trading_date_time", "")),
            "TradgCpcty": row.get("trading_capacity", ""),
            "Qty": float(row.get("quantity", 0)),
            "QtyCcy": row.get("quantity_currency", ""),
            "Pric": float(row.get("price", 0)),
            "PricCcy": row.get("price_currency", ""),
            "NetAmt": float(row.get("net_amount", 0)) if row.get("net_amount") else 0,

            # Instrument
            "FinInstrmId": row.get("instrument_isin", ""),
            "FinInstrmFullNm": row.get("instrument_full_name", ""),
            "FinInstrmClssfctn": row.get("instrument_classification", ""),

            # Venue
            "Venue": row.get("venue_mic", ""),
            "CtryOfBrnch": row.get("country_of_branch", ""),

            # Indicators
            "ShrtSellgInd": row.get("short_selling_indicator", ""),
            "TrnsmssnInd": row.get("transmission_indicator", False),
        }
        output.append(record)

    return pd.DataFrame(output)
'''

    version = ReportVersion(
        report_id=report.id,
        major_version=1,
        minor_version=0,
        version_number=1000,
        python_code=python_code,
        connector_id=connector_id,
        config={
            "output_format": "xml",
            "xml_root": "MiFIRReport",
            "xml_record_element": "Transaction",
            "regulatory_framework": "MiFIR",
            "report_type": "RTS25"
        },
        status=ReportVersionStatus.ACTIVE,
        created_by=user_id
    )
    db.add(version)
    db.flush()

    # Update report's current version
    report.current_version_id = version.id

    print(f"   Created demo report: {report.id} (version {version.version_string})")
    return report.id


def create_demo_validation_rules(db, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[uuid.UUID]:
    """Create demo validation rules for MiFIR data quality."""
    # Check if validation rules already exist
    existing = db.query(ValidationRule).filter(
        ValidationRule.tenant_id == tenant_id,
        ValidationRule.name.like("Demo:%")
    ).count()

    if existing > 0:
        print(f"   Demo validation rules already exist ({existing} rules)")
        return []

    validations = [
        {
            "name": "Demo: LEI Format Validation",
            "description": "Validates that LEI codes are exactly 20 alphanumeric characters",
            "rule_type": ValidationRuleType.PYTHON_EXPR,
            "expression": "len(str(row.get('ExctgPty', '') or '')) == 20",
            "severity": ValidationSeverity.BLOCKING,
            "error_message": "Invalid LEI format - must be exactly 20 alphanumeric characters"
        },
        {
            "name": "Demo: ISIN Format Validation",
            "description": "Validates that ISIN codes are 12 characters starting with 2 letters",
            "rule_type": ValidationRuleType.PYTHON_EXPR,
            "expression": "len(str(row.get('FinInstrmId', '') or '')) == 12 and str(row.get('FinInstrmId', ''))[:2].isalpha()",
            "severity": ValidationSeverity.BLOCKING,
            "error_message": "Invalid ISIN format - must be 12 characters starting with country code"
        },
        {
            "name": "Demo: Quantity Positive",
            "description": "Validates that quantity is a positive number",
            "rule_type": ValidationRuleType.PYTHON_EXPR,
            "expression": "float(row.get('Qty', 0) or 0) > 0",
            "severity": ValidationSeverity.BLOCKING,
            "error_message": "Quantity must be greater than zero"
        },
        {
            "name": "Demo: Price Positive",
            "description": "Validates that price is a positive number",
            "rule_type": ValidationRuleType.PYTHON_EXPR,
            "expression": "float(row.get('Pric', 0) or 0) > 0",
            "severity": ValidationSeverity.BLOCKING,
            "error_message": "Price must be greater than zero"
        },
        {
            "name": "Demo: Trading Capacity Valid",
            "description": "Validates trading capacity is one of: DEAL, MTCH, AOTC, PRIN",
            "rule_type": ValidationRuleType.PYTHON_EXPR,
            "expression": "str(row.get('TradgCpcty', '') or '') in ['DEAL', 'MTCH', 'AOTC', 'PRIN']",
            "severity": ValidationSeverity.BLOCKING,
            "error_message": "Invalid trading capacity - must be DEAL, MTCH, AOTC, or PRIN"
        },
    ]

    rule_ids = []
    for val_config in validations:
        rule = ValidationRule(
            tenant_id=tenant_id,
            name=val_config["name"],
            description=val_config["description"],
            rule_type=val_config["rule_type"],
            expression=val_config["expression"],
            severity=val_config["severity"],
            error_message=val_config["error_message"],
            is_active=True,
            created_by=user_id
        )
        db.add(rule)
        db.flush()
        rule_ids.append(rule.id)
        print(f"   Created validation rule: {val_config['name']}")

    return rule_ids


def create_demo_schedule(db, tenant_id: uuid.UUID, report_id: uuid.UUID) -> uuid.UUID:
    """Create a demo schedule for the MiFIR report."""
    # Check if demo schedule already exists
    existing = db.query(Schedule).filter(
        Schedule.tenant_id == tenant_id,
        Schedule.report_id == report_id,
        Schedule.name == "Daily MiFIR Demo Report"
    ).first()

    if existing:
        print(f"   Demo schedule already exists: {existing.id}")
        return existing.id

    schedule = Schedule(
        tenant_id=tenant_id,
        report_id=report_id,
        name="Daily MiFIR Demo Report",
        schedule_type=ScheduleType.CRON,
        cron_expression="0 6 * * *",  # Daily at 6:00 AM
        is_active=True,
        parameters={
            "business_date": "{{yesterday}}"
        }
    )
    db.add(schedule)
    db.flush()
    print(f"   Created demo schedule: {schedule.id} (cron: {schedule.cron_expression})")
    return schedule.id


def seed_demo_data():
    """
    Main function to seed all demo data.

    Creates:
    - Demo transactions table with 25 sample records
    - Demo PostgreSQL connector
    - Demo MiFIR report with transformation code
    - Demo validation rules (5 rules)
    - Demo schedule (daily at 6:00 AM)

    This function is idempotent - safe to run multiple times.
    """
    print("\n" + "=" * 60)
    print("Seeding Demo Data for OpenRegReport Portal")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Get the default tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            print("ERROR: Default tenant not found. Run init_db.py first.")
            return False

        print(f"\n1. Using tenant: {tenant.name} ({tenant.slug})")

        # Get admin user
        admin_user = db.query(User).filter(
            User.tenant_id == tenant.id,
            User.email == "admin@example.com"
        ).first()

        if not admin_user:
            print("ERROR: Admin user not found. Run init_db.py first.")
            return False

        print(f"   Admin user: {admin_user.email}")

        # Create demo transactions table and data
        print("\n2. Creating demo transactions table and data...")
        create_demo_transactions_table(db)
        transactions = generate_sample_transactions(25)
        insert_demo_transactions(db, transactions)

        # Create demo connector
        print("\n3. Creating demo connector...")
        connector_id = create_demo_connector(db, tenant.id, admin_user.id)

        # Create demo report
        print("\n4. Creating demo MiFIR report...")
        report_id = create_demo_report(db, tenant.id, connector_id, admin_user.id)

        # Create demo validation rules
        print("\n5. Creating demo validation rules...")
        create_demo_validation_rules(db, tenant.id, admin_user.id)

        # Create demo schedule
        print("\n6. Creating demo schedule...")
        create_demo_schedule(db, tenant.id, report_id)

        db.commit()

        print("\n" + "=" * 60)
        print("Demo Data Seeding Complete!")
        print("=" * 60)
        print("""
What's been created:
- 25 sample MiFIR transactions in mifir_demo_transactions table
- Demo PostgreSQL connector (self-referencing to OpenReg database)
- MiFIR Daily Transaction Report (ready to execute)
- 5 validation rules (LEI, ISIN, Quantity, Price, Trading Capacity)
- Daily schedule (runs at 6:00 AM)

Next steps:
1. Open http://localhost:3000
2. Login with admin@example.com / admin123
3. Navigate to Reports
4. Click "Run" on "MiFIR Daily Transaction Report"
5. View results in the Runs section
""")
        return True

    except Exception as e:
        print(f"\nERROR: Failed to seed demo data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
