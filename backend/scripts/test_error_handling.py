import sys
import os

# Add backend to path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from services.database import DatabaseService, DatabaseConnectionError
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def test_connection_error():
    # Intentionally WRONG credentials
    config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'database': os.environ.get('POSTGRES_DB', 'openreg')
    }
    credentials = {
        'username': 'WRONG_USER',
        'password': 'WRONG_PASSWORD'
    }
    
    db_type = 'postgresql'

    print(f"Testing DatabaseService with INVALID credentials...")

    try:
        DatabaseService.get_tables(db_type, config, credentials)
        print("FAIL: Should have raised DatabaseConnectionError")
    except DatabaseConnectionError as e:
        print(f"SUCCESS: Caught expected DatabaseConnectionError: {e}")
    except Exception as e:
        print(f"FAIL: Caught unexpected exception type {type(e).__name__}: {e}")

if __name__ == "__main__":
    test_connection_error()
