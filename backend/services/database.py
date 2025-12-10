"""
Database Connection Service

Provides real connection testing and query execution for various database types.
"""

import logging
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class DatabaseConnectionError(Exception):
    """Raised when database connection fails"""
    pass


class DatabaseService:
    """Service for testing and executing database connections"""
    
    SUPPORTED_TYPES = ['postgresql', 'mysql', 'sqlserver', 'oracle', 'odbc']
    
    @staticmethod
    def test_connection(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Test database connection with given parameters.
        
        Args:
            db_type: Database type (postgresql, mysql, sqlserver, etc.)
            config: Connection config (host, port, database)
            credentials: Username and password
            
        Returns:
            Dict with status, message, and optional metadata
        """
        try:
            if db_type == 'postgresql':
                return DatabaseService._test_postgresql(config, credentials)
            elif db_type == 'mysql':
                return DatabaseService._test_mysql(config, credentials)
            elif db_type == 'sqlserver':
                return DatabaseService._test_sqlserver(config, credentials)
            elif db_type == 'oracle':
                return DatabaseService._test_oracle(config, credentials)
            elif db_type == 'odbc':
                return DatabaseService._test_odbc(config, credentials)
            else:
                return {
                    "status": "error",
                    "message": f"Unsupported database type: {db_type}"
                }
        except Exception as e:
            logger.error(f"Connection test failed for {db_type}: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    @staticmethod
    def _test_postgresql(config: Dict, credentials: Dict) -> Dict[str, Any]:
        """Test PostgreSQL connection using psycopg2"""
        try:
            import psycopg2
            
            conn = psycopg2.connect(
                host=config.get('host', 'localhost'),
                port=config.get('port', 5432),
                database=config.get('database', 'postgres'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )
            
            # Get server version
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            
            cursor.close()
            conn.close()
            
            return {
                "status": "success",
                "message": "Connection successful",
                "metadata": {
                    "server_version": version.split(',')[0] if version else "Unknown"
                }
            }
        except ImportError:
            return {
                "status": "error",
                "message": "psycopg2 driver not installed"
            }
        except Exception as e:
            raise DatabaseConnectionError(f"PostgreSQL connection failed: {str(e)}")
    
    @staticmethod
    def _test_mysql(config: Dict, credentials: Dict) -> Dict[str, Any]:
        """Test MySQL connection using pymysql"""
        try:
            import pymysql
            
            conn = pymysql.connect(
                host=config.get('host', 'localhost'),
                port=int(config.get('port', 3306)),
                database=config.get('database', 'mysql'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=10
            )
            
            cursor = conn.cursor()
            cursor.execute("SELECT VERSION();")
            version = cursor.fetchone()[0]
            
            cursor.close()
            conn.close()
            
            return {
                "status": "success",
                "message": "Connection successful",
                "metadata": {
                    "server_version": f"MySQL {version}"
                }
            }
        except ImportError:
            return {
                "status": "error", 
                "message": "pymysql driver not installed"
            }
        except Exception as e:
            raise DatabaseConnectionError(f"MySQL connection failed: {str(e)}")
    
    @staticmethod
    def _test_sqlserver(config: Dict, credentials: Dict) -> Dict[str, Any]:
        """Test SQL Server connection using pyodbc"""
        try:
            import pyodbc
            
            driver = config.get('driver', 'ODBC Driver 17 for SQL Server')
            conn_str = (
                f"DRIVER={{{driver}}};"
                f"SERVER={config.get('host', 'localhost')},{config.get('port', 1433)};"
                f"DATABASE={config.get('database', 'master')};"
                f"UID={credentials.get('username')};"
                f"PWD={credentials.get('password')};"
                f"Connection Timeout=10;"
            )
            
            conn = pyodbc.connect(conn_str)
            cursor = conn.cursor()
            cursor.execute("SELECT @@VERSION;")
            version = cursor.fetchone()[0]
            
            cursor.close()
            conn.close()
            
            return {
                "status": "success",
                "message": "Connection successful",
                "metadata": {
                    "server_version": version.split('\n')[0] if version else "Unknown"
                }
            }
        except ImportError:
            return {
                "status": "error",
                "message": "pyodbc driver not installed"
            }
        except Exception as e:
            raise DatabaseConnectionError(f"SQL Server connection failed: {str(e)}")
    
    @staticmethod
    def _test_oracle(config: Dict, credentials: Dict) -> Dict[str, Any]:
        """Test Oracle connection using oracledb"""
        try:
            import oracledb
            
            dsn = f"{config.get('host', 'localhost')}:{config.get('port', 1521)}/{config.get('database', 'ORCL')}"
            
            conn = oracledb.connect(
                user=credentials.get('username'),
                password=credentials.get('password'),
                dsn=dsn
            )
            
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM v$version WHERE banner LIKE 'Oracle%'")
            version = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return {
                "status": "success",
                "message": "Connection successful",
                "metadata": {
                    "server_version": version[0] if version else "Oracle Database"
                }
            }
        except ImportError:
            return {
                "status": "error",
                "message": "oracledb driver not installed"
            }
        except Exception as e:
            raise DatabaseConnectionError(f"Oracle connection failed: {str(e)}")
    
    @staticmethod
    def _test_odbc(config: Dict, credentials: Dict) -> Dict[str, Any]:
        """Test generic ODBC connection"""
        try:
            import pyodbc
            
            conn_str = config.get('connection_string', '')
            if not conn_str:
                return {
                    "status": "error",
                    "message": "ODBC connection string is required"
                }
            
            # Replace placeholders
            conn_str = conn_str.replace('{username}', credentials.get('username', ''))
            conn_str = conn_str.replace('{password}', credentials.get('password', ''))
            
            conn = pyodbc.connect(conn_str, timeout=10)
            conn.close()
            
            return {
                "status": "success",
                "message": "Connection successful",
                "metadata": {}
            }
        except ImportError:
            return {
                "status": "error",
                "message": "pyodbc driver not installed"
            }
        except Exception as e:
            raise DatabaseConnectionError(f"ODBC connection failed: {str(e)}")

    @staticmethod
    @contextmanager
    def get_connection(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str]
    ):
        """
        Context manager for database connections.
        
        Usage:
            with DatabaseService.get_connection(type, config, creds) as conn:
                cursor = conn.cursor()
                cursor.execute(query)
        """
        conn = None
        try:
            if db_type == 'postgresql':
                import psycopg2
                conn = psycopg2.connect(
                    host=config.get('host'),
                    port=config.get('port', 5432),
                    database=config.get('database'),
                    user=credentials.get('username'),
                    password=credentials.get('password'),
                    connect_timeout=30
                )
            elif db_type == 'mysql':
                import pymysql
                conn = pymysql.connect(
                    host=config.get('host'),
                    port=int(config.get('port', 3306)),
                    database=config.get('database'),
                    user=credentials.get('username'),
                    password=credentials.get('password'),
                    connect_timeout=30
                )
            elif db_type == 'sqlserver':
                import pyodbc
                driver = config.get('driver', 'ODBC Driver 17 for SQL Server')
                conn_str = (
                    f"DRIVER={{{driver}}};"
                    f"SERVER={config.get('host')},{config.get('port', 1433)};"
                    f"DATABASE={config.get('database')};"
                    f"UID={credentials.get('username')};"
                    f"PWD={credentials.get('password')};"
                )
                conn = pyodbc.connect(conn_str)
            else:
                raise DatabaseConnectionError(f"Unsupported database type: {db_type}")
            
            yield conn
            
        finally:
            if conn:
                conn.close()
