import sys
import os
from typing import Dict, Any

# Add backend to path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Mock database module if needed or rely on docker environment
try:
    from services.database import DatabaseService
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def test_service_layer():
    # Credentials
    config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'database': os.environ.get('POSTGRES_DB', 'openreg')
    }
    credentials = {
        'username': os.environ.get('POSTGRES_USER', 'openreg'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'openreg_dev_password')
    }
    
    db_type = 'postgresql'

    print(f"Testing DatabaseService with {config['host']}:{config['port']} / {config['database']}")

    try:
        # 1. Get Tables
        print("\n--- DatabaseService.get_tables ---")
        tables = DatabaseService.get_tables(db_type, config, credentials)
        for t in tables:
            print(f"{t['full_name']} ({t['type']})")
            
        # 2. Get Columns for 'public.mifir_transactions'
        target_name = 'mifir_transactions'
        target_schema = 'public'
        
        # Verify it's in the list
        found = False
        selected_table_info = None
        for t in tables:
            if t['name'] == target_name and t['schema'] == target_schema:
                found = True
                selected_table_info = t
                break
        
        if not found:
            print(f"\nWARNING: {target_schema}.{target_name} not found in table list!")
        
        print(f"\n--- DatabaseService.get_columns ({target_schema}.{target_name}) ---")
        try:
            # Emulate exactly what api/connectors.py does
            columns = DatabaseService.get_columns(
                db_type=db_type,
                config=config,
                credentials=credentials,
                table_name=target_name,
                schema_name=target_schema
            )
            print(f"Found {len(columns)} columns.")
            for c in columns:
                print(f" - {c['name']} ({c['type']})")
                
        except Exception as e:
            print(f"ERROR calling get_columns: {e}")
            import traceback
            traceback.print_exc()

    except Exception as e:
        print(f"General Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_service_layer()
