"""
Create MiFIR Report via API

This script uses the OpenReg API to create:
- External API configuration for regulatory data sync
- Database connector
- MiFIR Report with transformation code
- Validation rules
- Schedule
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"


def setup_external_api(headers):
    """Set up External API configuration for regulatory data sync"""
    print("\n0. Setting up External API Integration...")

    # Check for existing external API configs
    configs = requests.get(f"{BASE_URL}/external-api/configs", headers=headers)
    if configs.status_code == 200:
        existing = configs.json()
        for c in existing:
            if "ESMA" in c.get("name", "") or "MiFIR" in c.get("name", ""):
                print(f"   ✓ Using existing External API config: {c['name']}")
                return c["id"]

    # Create new External API configuration
    # This simulates connection to ESMA's regulatory API
    external_api_config = {
        "name": "ESMA MiFIR Regulatory API",
        "description": "Connection to ESMA's regulatory data API for syncing MiFIR report templates, validation rules, and reference data",
        "api_base_url": "https://api.esma.europa.eu/mifir/v2",  # Simulated URL
        "api_version": "v2",
        "auth_type": "api_key",
        "credentials": {
            "api_key": "demo-esma-api-key-12345",
            "api_secret": "demo-secret"
        },
        "rate_limit_per_minute": 30,
        "retry_config": {
            "max_retries": 3,
            "backoff_factor": 2
        },
        "cache_ttl_seconds": 3600,
        "sync_schedule": "0 2 * * *",  # Daily at 2 AM
        "auto_sync_enabled": True,
        "schema_mapping": {
            "reports": {
                "source_path": "/reports",
                "id_field": "report_id",
                "name_field": "report_name",
                "mapping": {
                    "report_id": "external_id",
                    "report_name": "name",
                    "report_description": "description",
                    "transformation_code": "python_code",
                    "output_format": "config.output_format",
                    "version": "upstream_version"
                }
            },
            "validations": {
                "source_path": "/validation-rules",
                "id_field": "rule_id",
                "name_field": "rule_name",
                "mapping": {
                    "rule_id": "external_id",
                    "rule_name": "name",
                    "description": "description",
                    "expression": "expression",
                    "severity": "severity",
                    "error_message": "error_message",
                    "version": "upstream_version"
                }
            },
            "reference_data": {
                "source_path": "/reference-data/mapping-sets",
                "id_field": "mapping_set_id",
                "name_field": "mapping_set_name",
                "mapping": {
                    "mapping_set_id": "external_id",
                    "mapping_set_name": "name",
                    "description": "description",
                    "entries": "entries",
                    "version": "upstream_version"
                }
            },
            "schedules": {
                "source_path": "/schedules",
                "id_field": "schedule_id",
                "name_field": "schedule_name",
                "mapping": {
                    "schedule_id": "external_id",
                    "schedule_name": "name",
                    "cron": "cron_expression",
                    "timezone": "timezone",
                    "version": "upstream_version"
                }
            }
        }
    }

    response = requests.post(
        f"{BASE_URL}/external-api/configs",
        headers=headers,
        json=external_api_config
    )

    if response.status_code == 201:
        config_data = response.json()
        print(f"   ✓ Created External API config: {config_data['name']}")
        print(f"     - ID: {config_data['id']}")
        print(f"     - API URL: {external_api_config['api_base_url']}")
        print(f"     - Sync Schedule: {external_api_config['sync_schedule']} (Daily at 2 AM)")
        return config_data["id"]
    else:
        print(f"   ⚠ External API config creation: {response.status_code} - {response.text[:200]}")
        return None

# Login and get token
def get_token():
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    response.raise_for_status()
    return response.json()["access_token"]

def main():
    print("=" * 60)
    print("MiFIR Report Setup via API")
    print("=" * 60)

    # Get auth token
    print("\n1. Authenticating...")
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    print("   ✓ Authentication successful")

    # Setup External API Integration
    external_api_id = setup_external_api(headers)

    # Check for existing connector or create new one
    print("\n2. Setting up database connector...")
    connectors = requests.get(f"{BASE_URL}/connectors", headers=headers).json()
    connector_id = None

    for c in connectors:
        if "MiFIR" in c["name"] or "Production" in c["name"]:
            connector_id = c["id"]
            print(f"   ✓ Using existing connector: {c['name']}")
            break

    if not connector_id:
        connector_response = requests.post(f"{BASE_URL}/connectors", headers=headers, json={
            "name": "MiFIR Production Database",
            "description": "PostgreSQL database containing MiFIR transaction data",
            "type": "postgresql",
            "config": {
                "host": "postgres",
                "port": 5432,
                "database": "openreg"
            },
            "credentials": {
                "username": "openreg",
                "password": "openreg_dev_password"
            }
        })
        connector_response.raise_for_status()
        connector_id = connector_response.json()["id"]
        print(f"   ✓ Created new connector: {connector_id}")

    # Check for existing report or create new one
    print("\n3. Creating MiFIR report...")
    reports = requests.get(f"{BASE_URL}/reports", headers=headers).json()
    report_id = None

    for r in reports:
        if "MiFIR" in r["name"]:
            report_id = r["id"]
            print(f"   ✓ Using existing report: {r['name']}")
            break

    if not report_id:
        report_response = requests.post(f"{BASE_URL}/reports", headers=headers, json={
            "name": "MiFIR RTS 25 Transaction Report",
            "description": "MiFIR RTS 25 transaction reporting for regulatory compliance. Generates XML output per ESMA specifications.",
            "connector_id": connector_id,
            "config": {
                "output_format": "xml",
                "regulatory_framework": "MiFIR",
                "report_type": "RTS25"
            }
        })
        report_response.raise_for_status()
        report_id = report_response.json()["id"]
        print(f"   ✓ Created new report: {report_id}")

    # Create report version with Python code
    print("\n4. Creating report version with transformation code...")

    python_code = '''def transform(db, mappings, params):
    """MiFIR RTS 25 Transaction Report Generator"""
    import pandas as pd
    from datetime import datetime

    # Get business date from params or use today
    business_date = params.get("business_date", datetime.now().strftime("%Y-%m-%d"))

    # Fetch transactions from the MiFIR table
    query = f"""
        SELECT * FROM mifir_transactions
        WHERE business_date = '{business_date}'
        OR status = 'validated'
        ORDER BY trading_date_time
        LIMIT 500
    """
    df = db.query(query)

    if df.empty:
        # If no data for business date, get all pending transactions
        df = db.query("SELECT * FROM mifir_transactions WHERE status = 'pending' LIMIT 100")

    # Map database columns to MiFIR XML fields (ISO 20022 format)
    output = []
    for _, row in df.iterrows():
        record = {
            # Transaction Identification
            "TxId": row.get("transaction_reference", ""),
            "ExctgPty": row.get("executing_entity_lei", ""),
            "SubmitgPty": row.get("submitting_entity_lei", ""),

            # Investment Decision
            "InvstmtDcsnPrsn_Algo": row.get("investment_decision_within_firm", ""),
            "InvstmtDcsnPrsn_Prsn": row.get("investment_decision_person_code", ""),
            "ExctgPrsn_Algo": row.get("execution_within_firm", ""),
            "ExctgPrsn_Prsn": row.get("execution_person_code", ""),

            # Buyer
            "Buyr_LEI": row.get("buyer_lei", ""),
            "Buyr_FrstNm": row.get("buyer_first_name", ""),
            "Buyr_Nm": row.get("buyer_surname", ""),
            "Buyr_BirthDt": str(row.get("buyer_date_of_birth", "")) if row.get("buyer_date_of_birth") else "",
            "Buyr_Ctry": row.get("buyer_country", ""),

            # Seller
            "Sellr_LEI": row.get("seller_lei", ""),
            "Sellr_FrstNm": row.get("seller_first_name", ""),
            "Sellr_Nm": row.get("seller_surname", ""),
            "Sellr_BirthDt": str(row.get("seller_date_of_birth", "")) if row.get("seller_date_of_birth") else "",
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

    version_response = requests.post(f"{BASE_URL}/reports/{report_id}/versions", headers=headers, json={
        "python_code": python_code,
        "connector_id": connector_id,
        "config": {
            "output_format": "xml",
            "xml_root": "MiFIRReport",
            "xml_record_element": "Transaction"
        }
    })

    if version_response.status_code == 201:
        version_data = version_response.json()
        print(f"   ✓ Created version {version_data.get('version_string', 'v1.0')}")
    else:
        print(f"   ⚠ Version creation: {version_response.status_code} - {version_response.text[:200]}")

    # Create validation rules
    print("\n5. Creating validation rules...")

    validations = [
        {
            "name": "LEI Format Validation",
            "description": "Validates that LEI codes are exactly 20 characters",
            "rule_type": "python_expr",
            "expression": "len(str(row.get('ExctgPty', '') or '')) == 20",
            "severity": "blocking",
            "error_message": "Invalid LEI format - must be exactly 20 characters",
            "field_name": "ExctgPty",
            "is_active": True
        },
        {
            "name": "ISIN Format Validation",
            "description": "Validates that ISIN codes are exactly 12 characters",
            "rule_type": "python_expr",
            "expression": "len(str(row.get('FinInstrmId', '') or '')) == 12",
            "severity": "blocking",
            "error_message": "Invalid ISIN format - must be exactly 12 characters",
            "field_name": "FinInstrmId",
            "is_active": True
        },
        {
            "name": "Quantity Positive",
            "description": "Validates that quantity is a positive number",
            "rule_type": "python_expr",
            "expression": "float(row.get('Qty', 0) or 0) > 0",
            "severity": "blocking",
            "error_message": "Quantity must be a positive number",
            "field_name": "Qty",
            "is_active": True
        },
        {
            "name": "Price Positive",
            "description": "Validates that price is a positive number",
            "rule_type": "python_expr",
            "expression": "float(row.get('Pric', 0) or 0) > 0",
            "severity": "blocking",
            "error_message": "Price must be a positive number",
            "field_name": "Pric",
            "is_active": True
        },
        {
            "name": "Trading Capacity Valid",
            "description": "Validates trading capacity is one of: DEAL, MTCH, AOTC, PRIN",
            "rule_type": "python_expr",
            "expression": "str(row.get('TradgCpcty', '') or '') in ['DEAL', 'MTCH', 'AOTC', 'PRIN']",
            "severity": "blocking",
            "error_message": "Invalid trading capacity - must be DEAL, MTCH, AOTC, or PRIN",
            "field_name": "TradgCpcty",
            "is_active": True
        },
        {
            "name": "Venue MIC Valid",
            "description": "Validates venue MIC code is 4 characters",
            "rule_type": "python_expr",
            "expression": "len(str(row.get('Venue', '') or '')) == 4",
            "severity": "warning",
            "error_message": "Venue MIC should be exactly 4 characters",
            "field_name": "Venue",
            "is_active": True
        }
    ]

    for val in validations:
        val_response = requests.post(f"{BASE_URL}/validations", headers=headers, json=val)
        if val_response.status_code == 201:
            print(f"   ✓ Created validation: {val['name']}")
        else:
            print(f"   ⚠ {val['name']}: {val_response.status_code}")

    # Create schedule
    print("\n6. Creating schedule...")

    schedule_response = requests.post(f"{BASE_URL}/schedules", headers=headers, json={
        "report_id": report_id,
        "name": "Daily MiFIR Report",
        "description": "Runs MiFIR transaction report daily at 6:00 AM",
        "cron_expression": "0 6 * * *",  # 6 AM daily
        "timezone": "Europe/Amsterdam",
        "parameters": {
            "business_date": "{{yesterday}}"
        },
        "is_active": True
    })

    if schedule_response.status_code == 201:
        print(f"   ✓ Created schedule: Daily MiFIR Report")
    else:
        print(f"   ⚠ Schedule creation: {schedule_response.status_code} - {schedule_response.text[:200]}")

    # Summary
    print("\n" + "=" * 60)
    print("SETUP COMPLETE!")
    print("=" * 60)
    print(f"""
Summary:
- External API Config ID: {external_api_id}
- Connector ID: {connector_id}
- Report ID: {report_id}
- MiFIR Transactions Table: mifir_transactions (50 sample records)
- Validation Rules: {len(validations)} rules created
- Schedule: Daily at 6:00 AM
- External API Sync: Daily at 2:00 AM

You can now:
1. Visit http://localhost:3000 to see the frontend
2. Navigate to "External API" to see the regulatory API connection
3. Navigate to Reports to see the MiFIR report
4. Execute the report manually or wait for the schedule
5. View results in the Runs section
""")

if __name__ == "__main__":
    main()
