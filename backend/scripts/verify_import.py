import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from services.auth import InvalidToken
    print("SUCCESS: InvalidToken imported successfully")
except ImportError as e:
    print(f"FAIL: {e}")
except Exception as e:
    print(f"FAIL: {e}")
