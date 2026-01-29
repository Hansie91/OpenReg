"""
Database initialization script

Creates initial tenant, admin user, and default roles.
Run this after first startup to populate the database.

Usage:
    python init_db.py           # Basic initialization only
    python init_db.py --demo    # Include demo data (recommended for first-time users)
    python init_db.py --help    # Show help
"""

import argparse
from database import SessionLocal, engine, Base
from models import Tenant, User, Role, UserRole
from services.auth import hash_password
import uuid


def init_db(include_demo: bool = False):
    """
    Initialize database with default data.

    Args:
        include_demo: If True, also seeds demo data (connector, report, validations, sample transactions)
    """
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    created_new = False

    try:
        # Check if default tenant exists
        existing_tenant = db.query(Tenant).filter(Tenant.slug == "default").first()
        if existing_tenant:
            print("Default tenant already exists. Skipping basic initialization.")
        else:
            created_new = True
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

        # Seed demo data if requested
        if include_demo:
            print("\nSeeding demo data...")
            try:
                from scripts.seed_demo_data import seed_demo_data
                success = seed_demo_data()
                if success:
                    print("\n" + "="*50)
                    print("Demo Data: MiFIR Daily Transaction Report ready to execute")
                    print("="*50)
            except ImportError as e:
                print(f"Warning: Could not import seed_demo_data: {e}")
                print("Demo data not seeded. You can run it manually:")
                print("  python -c \"from scripts.seed_demo_data import seed_demo_data; seed_demo_data()\"")
            except Exception as e:
                print(f"Warning: Failed to seed demo data: {e}")
                print("Basic initialization completed, but demo data was not added.")

    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Parse command line arguments and run initialization."""
    parser = argparse.ArgumentParser(
        description="Initialize OpenRegReport Portal database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python init_db.py           Basic initialization (tenant, admin user, roles)
  python init_db.py --demo    Include demo data (recommended for first-time users)

Demo data includes:
  - Demo PostgreSQL connector (self-referencing)
  - MiFIR Daily Transaction Report (ready to execute)
  - 25 sample MiFIR transactions
  - 5 validation rules (LEI, ISIN, Quantity, Price, Trading Capacity)
  - Daily schedule (6:00 AM)
        """
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Include demo data with sample MiFIR report, connector, validations, and transactions"
    )

    args = parser.parse_args()
    init_db(include_demo=args.demo)


if __name__ == "__main__":
    main()
