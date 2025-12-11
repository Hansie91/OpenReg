"""
PostgreSQL Database Connector

Implements connection to PostgreSQL databases using psycopg2 with
connection pooling, query execution, and streaming support.
"""

import psycopg2
import psycopg2.extras
import psycopg2.pool
from typing import Dict, Any, Optional, List, Tuple
import logging
import signal

from services.connectors.base import DatabaseConnector
from services.database import (
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTimeoutError
)

logger = logging.getLogger(__name__)


class PostgreSQLConnector(DatabaseConnector):
    """PostgreSQL database connector using psycopg2"""
    
    def __init__(self, config: Dict[str, Any], credentials: Dict[str, str]):
        """
        Initialize PostgreSQL connector.
        
        Args:
            config: Must contain 'host', 'port', 'database'
                   Optional: 'sslmode', 'connect_timeout', 'options'
            credentials: Must contain 'username' and 'password'
        """
        super().__init__(config, credentials)
        self._cursor = None
    
    def _get_connection_params(self) -> Dict[str, Any]:
        """Build psycopg2 connection parameters"""
        params = {
            'host': self.config.get('host', 'localhost'),
            'port': self.config.get('port', 5432),
            'database': self.config['database'],
            'user': self.credentials['username'],
            'password': self.credentials['password'],
            'connect_timeout': self.config.get('connect_timeout', 10),
        }
        
        # Optional SSL configuration
        if 'sslmode' in self.config:
            params['sslmode'] = self.config['sslmode']
        
        # Optional connection options
        if 'options' in self.config:
            params['options'] = self.config['options']
        
        return params
    
    def connect(self) -> None:
        """Establish PostgreSQL connection"""
        try:
            params = self._get_connection_params()
            logger.info(f"Connecting to PostgreSQL at {params['host']}:{params['port']}/{params['database']}")
            
            self._connection = psycopg2.connect(**params)
            self._connection.set_session(autocommit=True)  # Auto-commit for SELECT queries
            
            logger.info("PostgreSQL connection established")
            
        except psycopg2.OperationalError as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            raise DatabaseConnectionError(f"Failed to connect to PostgreSQL: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error connecting to PostgreSQL: {e}")
            raise DatabaseConnectionError(f"Connection error: {str(e)}")
    
    def disconnect(self) -> None:
        """Close PostgreSQL connection"""
        try:
            if self._cursor:
                self._cursor.close()
                self._cursor = None
            
            if self._connection:
                self._connection.close()
                self._connection = None
                logger.info("PostgreSQL connection closed")
                
        except Exception as e:
            logger.error(f"Error closing PostgreSQL connection: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test PostgreSQL connection and get server info"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get PostgreSQL version
                cursor.execute("SELECT version();")
                version = cursor.fetchone()[0]
                
                # Get current database
                cursor.execute("SELECT current_database();")
                database = cursor.fetchone()[0]
                
                cursor.close()
                
                return {
                    'success': True,
                    'message': 'Connection successful',
                    'server_version': version,
                    'database': database
                }
                
        except Exception as e:
            logger.error(f"PostgreSQL connection test failed: {e}")
            return {
                'success': False,
                'message': f'Connection test failed: {str(e)}'
            }
    
    def _timeout_handler(self, signum, frame):
        """Signal handler for query timeout"""
        raise DatabaseTimeoutError("Query execution exceeded timeout")
    
    def execute_query(
        self,
        query: str,
        params: Optional[Tuple] = None,
        timeout: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute PostgreSQL query and return all results.
        
        Args:
            query: SQL query string
            params: Optional parameters for parameterized query
            timeout: Optional timeout in seconds
            
        Returns:
            List of result rows as dictionaries
        """
        try:
            with self.get_connection() as conn:
                # Set statement timeout if provided
                if timeout:
                    cursor = conn.cursor()
                    cursor.execute(f"SET statement_timeout = {timeout * 1000}")  # milliseconds
                    cursor.close()
                
                # Execute query with dict cursor for named columns
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                # Fetch all results
                results = cursor.fetchall()
                
                cursor.close()
                
                # Convert RealDictRow to regular dict
                return [dict(row) for row in results]
                
        except psycopg2.extensions.QueryCanceledError as e:
            logger.error(f"Query timeout: {e}")
            raise DatabaseTimeoutError(f"Query exceeded timeout of {timeout}s")
        
        except psycopg2.ProgrammingError as e:
            logger.error(f"SQL syntax error: {e}")
            raise DatabaseQueryError(f"SQL error: {str(e)}")
        
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL query failed: {e}")
            raise DatabaseQueryError(f"Query execution failed: {str(e)}")
        
        except Exception as e:
            logger.error(f"Unexpected error executing query: {e}")
            raise DatabaseQueryError(f"Query error: {str(e)}")
    
    def execute_query_stream(
        self,
        query: str,
        params: Optional[Tuple] = None,
        chunk_size: int = 1000
    ):
        """
        Execute query and stream results in chunks.
        
        Uses server-side cursor for memory-efficient streaming.
        """
        try:
            with self.get_connection() as conn:
                # Create server-side cursor with unique name
                cursor_name = f"stream_cursor_{id(self)}"
                cursor = conn.cursor(
                    name=cursor_name,
                    cursor_factory=psycopg2.extras.RealDictCursor
                )
                
                # Set fetch size
                cursor.itersize = chunk_size
                
                # Execute query
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                # Stream results in chunks
                while True:
                    rows = cursor.fetchmany(chunk_size)
                    if not rows:
                        break
                    
                    # Convert to regular dicts and yield
                    yield [dict(row) for row in rows]
                
                cursor.close()
                
        except psycopg2.Error as e:
            logger.error(f"PostgreSQL streaming query failed: {e}")
            raise DatabaseQueryError(f"Streaming query failed: {str(e)}")
        
        except Exception as e:
            logger.error(f"Unexpected error in streaming query: {e}")
            raise DatabaseQueryError(f"Streaming error: {str(e)}")
