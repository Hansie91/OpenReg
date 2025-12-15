"""
Script to check the columns in mifir_transactions table
"""

import sys
import os
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import SessionLocal
from sqlalchemy import text

def check_table_columns():
    db = SessionLocal()
    try:
        # Get column info for mifir_transactions
        result = db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'mifir_transactions'
            ORDER BY ordinal_position
        """))
        
        columns = result.fetchall()
        
        print(f"\n{'='*60}")
        print(f"Columns in mifir_transactions table")
        print(f"{'='*60}\n")
        
        for col_name, data_type in columns:
            print(f"  {col_name}: {data_type}")
        
        if not columns:
            print("  (No columns found - table may not exist)")
            
        # Also get sample data
        try:
            result = db.execute(text("SELECT * FROM mifir_transactions LIMIT 1"))
            row = result.fetchone()
            if row:
                print(f"\n{'='*60}")
                print(f"Sample row:")
                print(f"{'='*60}\n")
                for i, col in enumerate(result.keys()):
                    print(f"  {col}: {row[i]}")
        except Exception as e:
            print(f"\nError getting sample data: {e}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_table_columns()
