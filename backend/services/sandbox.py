"""
Sandbox mode service.

Provides mock implementations for testing in sandbox environment:
- Mock database connectors that return sample data
- Simulated delivery that doesn't actually send files
- Test data generation utilities
"""

import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from uuid import UUID
import random
import string

from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)


class SandboxService:
    """Service for sandbox mode operations."""

    @staticmethod
    def is_sandbox_mode(db: Session, tenant_id: UUID) -> bool:
        """
        Check if a tenant is in sandbox mode.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            True if tenant is in sandbox mode
        """
        tenant = db.query(models.Tenant).filter(
            models.Tenant.id == tenant_id
        ).first()

        if not tenant:
            return True  # Default to sandbox for safety

        return tenant.environment == models.TenantEnvironment.SANDBOX

    @staticmethod
    def get_mock_data(
        query: str,
        row_count: int = 100,
        columns: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate mock data for sandbox mode.

        Analyzes the SQL query to understand expected columns
        and generates appropriate sample data.

        Args:
            query: SQL query (used to infer column names)
            row_count: Number of rows to generate
            columns: Optional explicit column names

        Returns:
            List of dictionaries representing rows
        """
        # Try to extract column names from SELECT clause
        if not columns:
            columns = SandboxService._extract_columns_from_query(query)

        if not columns:
            # Default columns for regulatory reporting
            columns = [
                "id", "transaction_id", "counterparty_id", "amount",
                "currency", "trade_date", "settlement_date", "status"
            ]

        # Generate mock data
        rows = []
        for i in range(row_count):
            row = {}
            for col in columns:
                row[col] = SandboxService._generate_mock_value(col, i)
            rows.append(row)

        return rows

    @staticmethod
    def _extract_columns_from_query(query: str) -> List[str]:
        """Extract column names from a SELECT query."""
        try:
            query_upper = query.upper()
            if "SELECT" not in query_upper:
                return []

            # Find content between SELECT and FROM
            select_idx = query_upper.index("SELECT") + 6
            from_idx = query_upper.index("FROM") if "FROM" in query_upper else len(query)

            select_clause = query[select_idx:from_idx].strip()

            # Handle SELECT *
            if select_clause.strip() == "*":
                return []

            # Split by comma and extract column names
            columns = []
            for part in select_clause.split(","):
                part = part.strip()
                # Handle aliases (col AS alias)
                if " AS " in part.upper():
                    alias_idx = part.upper().index(" AS ")
                    columns.append(part[alias_idx + 4:].strip().strip('"').strip("'"))
                elif " " in part:
                    # Column with implicit alias
                    columns.append(part.split()[-1].strip('"').strip("'"))
                else:
                    # Extract just column name (may have table prefix)
                    if "." in part:
                        columns.append(part.split(".")[-1].strip('"').strip("'"))
                    else:
                        columns.append(part.strip('"').strip("'"))

            return columns

        except Exception as e:
            logger.warning(f"Failed to extract columns from query: {e}")
            return []

    @staticmethod
    def _generate_mock_value(column_name: str, index: int) -> Any:
        """Generate a mock value based on column name."""
        col_lower = column_name.lower()

        # ID fields
        if col_lower in ("id", "pk"):
            return index + 1
        if "id" in col_lower:
            return f"ID{index + 1000:06d}"

        # Amount/numeric fields
        if any(x in col_lower for x in ["amount", "value", "price", "quantity", "qty"]):
            return round(random.uniform(1000, 1000000), 2)

        # Currency
        if "currency" in col_lower or col_lower == "ccy":
            return random.choice(["USD", "EUR", "GBP", "JPY", "CHF"])

        # Date fields
        if "date" in col_lower:
            days_offset = random.randint(-30, 30)
            return (datetime.now().date().replace(day=1)).isoformat()

        # Time/timestamp fields
        if any(x in col_lower for x in ["time", "timestamp", "created", "updated"]):
            return datetime.now().isoformat()

        # Status fields
        if "status" in col_lower:
            return random.choice(["active", "pending", "completed", "cancelled"])

        # Name fields
        if "name" in col_lower:
            return f"Entity_{index + 1}"

        # Code fields
        if "code" in col_lower:
            return ''.join(random.choices(string.ascii_uppercase, k=4))

        # Email fields
        if "email" in col_lower:
            return f"user{index}@example.com"

        # Country fields
        if "country" in col_lower:
            return random.choice(["US", "GB", "DE", "FR", "JP", "CH"])

        # LEI (Legal Entity Identifier)
        if "lei" in col_lower:
            return ''.join(random.choices(string.ascii_uppercase + string.digits, k=20))

        # Boolean fields
        if any(x in col_lower for x in ["is_", "has_", "flag", "active", "enabled"]):
            return random.choice([True, False])

        # Description/text fields
        if any(x in col_lower for x in ["description", "desc", "comment", "note"]):
            return f"Sample description for row {index + 1}"

        # Default: string
        return f"value_{index + 1}"


class MockConnector:
    """
    Mock connector for sandbox mode.

    Simulates database connectivity without actually connecting.
    Returns generated sample data based on the query.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize mock connector."""
        self.config = config
        self.connected = False

    def connect(self) -> bool:
        """Simulate connection."""
        logger.info("Mock connector: Simulating database connection")
        self.connected = True
        return True

    def disconnect(self):
        """Simulate disconnection."""
        logger.info("Mock connector: Simulating disconnect")
        self.connected = False

    def execute_query(self, query: str, timeout: int = 300) -> List[Dict[str, Any]]:
        """
        Execute query returning mock data.

        Args:
            query: SQL query
            timeout: Query timeout (ignored in mock)

        Returns:
            List of mock data rows
        """
        if not self.connected:
            self.connect()

        logger.info(f"Mock connector: Generating mock data for query")

        # Determine row count from query if LIMIT specified
        row_count = 100
        query_upper = query.upper()
        if "LIMIT" in query_upper:
            try:
                limit_idx = query_upper.index("LIMIT") + 5
                limit_str = query_upper[limit_idx:].split()[0]
                row_count = min(int(limit_str), 1000)
            except (ValueError, IndexError):
                pass

        return SandboxService.get_mock_data(query, row_count)

    def test_connection(self) -> tuple[bool, str]:
        """Test mock connection."""
        return True, "Mock connection successful"


class MockDeliveryService:
    """
    Mock delivery service for sandbox mode.

    Simulates file delivery without actually sending files.
    """

    @staticmethod
    def simulate_delivery(
        artifact: models.Artifact,
        destination: models.Destination
    ) -> Dict[str, Any]:
        """
        Simulate artifact delivery.

        Args:
            artifact: Artifact to deliver
            destination: Destination configuration

        Returns:
            Simulated delivery result
        """
        logger.info(
            f"Mock delivery: Simulating delivery of {artifact.filename} "
            f"to {destination.name}"
        )

        # Simulate some processing time perception
        import time
        time.sleep(0.1)

        # Randomly simulate occasional failures for testing
        if random.random() < 0.05:  # 5% failure rate
            return {
                "success": False,
                "message": "Simulated delivery failure for testing",
                "simulated": True
            }

        return {
            "success": True,
            "message": f"Mock delivery of {artifact.filename} to {destination.name} completed",
            "simulated": True,
            "mock_remote_path": f"/sandbox/deliveries/{artifact.filename}",
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def upload_file_sftp(
        host: str,
        port: int,
        username: str,
        password: str,
        local_path: str,
        remote_path: str
    ) -> Dict[str, Any]:
        """Mock SFTP upload."""
        logger.info(f"Mock SFTP: Would upload to {host}:{port}{remote_path}")
        return {
            "success": True,
            "message": f"Mock SFTP upload to {host}:{remote_path}",
            "simulated": True
        }

    @staticmethod
    def upload_file_ftp(
        host: str,
        port: int,
        username: str,
        password: str,
        local_path: str,
        remote_path: str,
        use_tls: bool = False
    ) -> Dict[str, Any]:
        """Mock FTP upload."""
        protocol = "FTPS" if use_tls else "FTP"
        logger.info(f"Mock {protocol}: Would upload to {host}:{port}{remote_path}")
        return {
            "success": True,
            "message": f"Mock {protocol} upload to {host}:{remote_path}",
            "simulated": True
        }


def get_connector_for_tenant(
    db: Session,
    tenant_id: UUID,
    connector: models.Connector
) -> Any:
    """
    Get appropriate connector based on tenant environment.

    In sandbox mode, returns a mock connector.
    In production mode, returns the real connector.

    Args:
        db: Database session
        tenant_id: Tenant ID
        connector: Connector configuration

    Returns:
        Connector instance (mock or real)
    """
    if SandboxService.is_sandbox_mode(db, tenant_id):
        logger.info(f"Sandbox mode: Using mock connector for tenant {tenant_id}")
        return MockConnector(connector.config)

    # Import and return real connector
    from services.connectors.factory import ConnectorFactory
    return ConnectorFactory.create_connector(
        db_type=connector.type.value,
        config=connector.config,
        encrypted_credentials=connector.encrypted_credentials
    )


def should_skip_delivery(db: Session, tenant_id: UUID) -> bool:
    """
    Check if delivery should be skipped (sandbox mode).

    Args:
        db: Database session
        tenant_id: Tenant ID

    Returns:
        True if delivery should be skipped
    """
    return SandboxService.is_sandbox_mode(db, tenant_id)


def get_delivery_service(db: Session, tenant_id: UUID) -> Any:
    """
    Get appropriate delivery service based on tenant environment.

    Args:
        db: Database session
        tenant_id: Tenant ID

    Returns:
        Delivery service (mock or real)
    """
    if SandboxService.is_sandbox_mode(db, tenant_id):
        return MockDeliveryService

    from services.delivery import DeliveryService
    return DeliveryService
