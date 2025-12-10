"""
Database initialization script

Creates initial tenant, admin user, and default roles.
Run this after first startup to populate the database.
"""

from database import SessionLocal, engine, Base
from models import Tenant, User, Role, UserRole
from services.auth import hash_password
import uuid

def init_db():
    """Initialize database with default data"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if default tenant exists
        existing_tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if existing_tenant:
            print("Default tenant already exists. Skipping initialization.")
            return
        
        print("Creating default tenant...")
        tenant = Tenant(
            name="Default Organization",
            slug="default",
            settings={}
        )
        db.add(tenant)
        db.flush()
        
        print("Creating admin role...")
        admin_role = Role(
            tenant_id=tenant.id,
            name="Administrator",
            description="Full system access",
            permissions=["*"]  # Wildcard permission
        )
        db.add(admin_role)
        db.flush()
        
        print("Creating default admin user...")
        admin_user = User(
            tenant_id=tenant.id,
            email="admin@example.com",
            hashed_password=hash_password("admin123"),
            full_name="System Administrator",
            is_active=True,
            is_superuser=True
        )
        db.add(admin_user)
        db.flush()
        
        print("Assigning admin role to user...")
        user_role = UserRole(
            user_id=admin_user.id,
            role_id=admin_role.id
        )
        db.add(user_role)
        
        db.commit()
        
        print("\n" + "="*50)
        print("Database initialized successfully!")
        print("="*50)
        print(f"Tenant: {tenant.name} ({tenant.slug})")
        print(f"Admin Email: admin@example.com")
        print(f"Admin Password: admin123")
        print("="*50)
        print("\nPlease change the admin password after first login!")
        print("="*50 + "\n")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
