"""
Base Database Connector

Abstract base class for all database connectors with common interface
for connection management, query execution, and resource handling.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Tuple
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)


class DatabaseConnector(ABC):
    """Abstract base class for database connectors"""
    
    def __init__(self, config: Dict[str, Any], credentials: Dict[str, str]):
        """
        Initialize connector with configuration and credentials.
        
        Args:
            config: Connection configuration (host, port, database, etc.)
            credentials: Decrypted username and password
        """
        self.config = config
        self.credentials = credentials
        self._connection = None
    
    @abstractmethod
    def connect(self) -> None:
        """
        Establish database connection.
        
        Raises:
            DatabaseConnectionError: If connection fails
        """
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """Close database connection and cleanup resources"""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Test connection and return status information.
        
        Returns:
            Dict with 'success' bool, 'message' str, and optional metadata
        """
        pass
    
    @abstractmethod
    def execute_query(
        self,
        query: str,
        params: Optional[Tuple] = None,
        timeout: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a query and return results.
        
        Args:
            query: SQL query to execute
            params: Optional query parameters for safe binding
            timeout: Optional timeout in seconds
            
        Returns:
            List of result rows as dictionaries
            
        Raises:
            DatabaseQueryError: If query execution fails
            DatabaseTimeoutError: If query exceeds timeout
        """
        pass
    
    @abstractmethod
    def execute_query_stream(
        self,
        query: str,
        params: Optional[Tuple] = None,
        chunk_size: int = 1000
    ):
        """
        Execute query and stream results in chunks for large datasets.
        
        Args:
            query: SQL query to execute
            params: Optional query parameters
            chunk_size: Number of rows per chunk
            
        Yields:
            List of dictionaries for each chunk
            
        Raises:
            DatabaseQueryError: If query execution fails
        """
        pass
    
    @contextmanager
    def get_connection(self):
        """
        Context manager for connection handling.
        
        Yields:
            Database connection object
        """
        try:
            if self._connection is None:
                self.connect()
            yield self._connection
        finally:
            # Connection is kept alive for reuse
            # Call disconnect() explicitly to close
            pass
    
    def is_connected(self) -> bool:
        """Check if connection is active"""
        return self._connection is not None
    
    def __enter__(self):
        """Allow using connector as context manager"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cleanup on context manager exit"""
        self.disconnect()
        return False
