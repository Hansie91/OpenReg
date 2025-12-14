"""
Migration script to add semantic versioning columns to report_versions table.

Run this script to update your database schema:
    python scripts/add_version_columns.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal

def run_migration():
    """Add major_version and minor_version columns to report_versions table"""
    
    db = SessionLocal()
    
    try:
        # Check if columns already exist
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'report_versions' AND column_name = 'major_version'
        """))
        
        if result.fetchone():
            print("✓ Columns already exist - nothing to do")
            return
        
        print("Adding major_version and minor_version columns...")
        
        # Add new columns with defaults
        db.execute(text("""
            ALTER TABLE report_versions 
            ADD COLUMN IF NOT EXISTS major_version INTEGER NOT NULL DEFAULT 1
        """))
        
        db.execute(text("""
            ALTER TABLE report_versions 
            ADD COLUMN IF NOT EXISTS minor_version INTEGER NOT NULL DEFAULT 0
        """))
        
        db.commit()
        print("✓ Added major_version and minor_version columns")
        
        # Update existing rows: convert version_number to major.minor
        # version_number 1 -> v1.0, version_number 2 -> v1.1, etc.
        print("Updating existing version records...")
        
        db.execute(text("""
            UPDATE report_versions 
            SET major_version = 1, 
                minor_version = COALESCE(version_number, 1) - 1
            WHERE major_version = 1 AND minor_version = 0
        """))
        
        db.commit()
        print("✓ Updated existing version records")
        
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("Semantic Versioning Migration")
    print("=" * 50)
    run_migration()
