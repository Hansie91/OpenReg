"""
Connector Factory

Factory pattern for creating database connector instances based on type.
Handles credential decryption and connector instantiation.
"""

from typing import Dict, Any
import logging

from services.connectors.base import DatabaseConnector
from services.connectors.postgresql import PostgreSQLConnector
from services.database import DatabaseConnectionError
from services.encryption import decrypt_credentials

logger = logging.getLogger(__name__)


class ConnectorFactory:
    """Factory for creating database connector instances"""
    
    # Registry of connector types
    _CONNECTOR_TYPES = {
        'postgresql': PostgreSQLConnector,
        # Future connectors:
        # 'sqlserver': SQLServerConnector,
        # 'oracle': OracleConnector,
        # 'mysql': MySQLConnector,
    }
    
    @classmethod
    def create_connector(
        cls,
        db_type: str,
        config: Dict[str, Any],
        encrypted_credentials: Dict[str, str]
    ) -> DatabaseConnector:
        """
        Create a connector instance for the specified database type.
        
        Args:
            db_type: Database type (e.g., 'postgresql', 'sqlserver')
            config: Connection configuration
            encrypted_credentials: Encrypted username and password
            
        Returns:
            DatabaseConnector instance
            
        Raises:
            DatabaseConnectionError: If connector type is unsupported
        """
        db_type_lower = db_type.lower()
        
        if db_type_lower not in cls._CONNECTOR_TYPES:
            supported = ', '.join(cls._CONNECTOR_TYPES.keys())
            raise DatabaseConnectionError(
                f"Unsupported database type '{db_type}'. "
                f"Supported types: {supported}"
            )
        
        # Decrypt credentials
        try:
            credentials = decrypt_credentials(encrypted_credentials)
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {e}")
            raise DatabaseConnectionError(f"Credential decryption failed: {str(e)}")
        
        # Instantiate connector
        connector_class = cls._CONNECTOR_TYPES[db_type_lower]
        logger.info(f"Creating {db_type} connector")
        
        return connector_class(config=config, credentials=credentials)
    
    @classmethod
    def get_supported_types(cls) -> list:
        """Get list of supported database types"""
        return list(cls._CONNECTOR_TYPES.keys())
    
    @classmethod
    def register_connector(cls, db_type: str, connector_class: type):
        """
        Register a new connector type (for extensions).
        
        Args:
            db_type: Database type identifier
            connector_class: Connector class (must inherit from DatabaseConnector)
        """
        if not issubclass(connector_class, DatabaseConnector):
            raise ValueError(
                f"Connector class must inherit from DatabaseConnector, "
                f"got {connector_class}"
            )
        
        cls._CONNECTOR_TYPES[db_type.lower()] = connector_class
        logger.info(f"Registered connector for '{db_type}'")
