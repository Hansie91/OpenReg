"""
Database Connection Service

Provides connection pooling, query execution, and testing for various database types.
Supports PostgreSQL, MySQL, SQL Server, Oracle, and generic ODBC connections.
"""

import logging
import time
from typing import Dict, Any, Optional, List, Generator, Tuple
from contextlib import contextmanager
from threading import Lock
import signal

logger = logging.getLogger(__name__)


# ==================== Custom Exceptions ====================

class DatabaseConnectionError(Exception):
    """Raised when database connection fails"""
    pass


class DatabaseQueryError(Exception):
    """Raised when query execution fails"""
    pass


class DatabaseTimeoutError(Exception):
    """Raised when query exceeds timeout"""
    pass


class DatabasePoolExhaustedError(Exception):
    """Raised when connection pool is exhausted"""
    pass


# ==================== Connection Pool Manager ====================

class ConnectionPoolManager:
    """Manages connection pools for different database types"""
    
    _pools = {}
    _pool_lock = Lock()
    
    @classmethod
    def get_pool(cls, pool_id: str, db_type: str, config: Dict, credentials: Dict, pool_config: Dict):
        """Get or create a connection pool"""
        with cls._pool_lock:
            if pool_id not in cls._pools:
                cls._pools[pool_id] = cls._create_pool(db_type, config, credentials, pool_config)
            return cls._pools[pool_id]
    
    @classmethod
    def _create_pool(cls, db_type: str, config: Dict, credentials: Dict, pool_config: Dict):
        """Create a new connection pool based on database type"""
        min_conn = pool_config.get('min_connections', 2)
        max_conn = pool_config.get('max_connections', 10)
        
        if db_type == 'postgresql':
            from psycopg2.pool import SimpleConnectionPool
            return SimpleConnectionPool(
                min_conn,
                max_conn,
                host=config.get('host'),
                port=config.get('port', 5432),
                database=config.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password')
            )
        elif db_type == 'oracle':
            import oracledb
            dsn = f"{config.get('host')}:{config.get('port', 1521)}/{config.get('database')}"
            return oracledb.create_pool(
                user=credentials.get('username'),
                password=credentials.get('password'),
                dsn=dsn,
                min=min_conn,
                max=max_conn
            )
        else:
            # For MySQL, SQL Server, and ODBC, we'll use a simple custom pool
            return SimplePool(db_type, config, credentials, min_conn, max_conn)
    
    @classmethod
    def close_pool(cls, pool_id: str):
        """Close and remove a connection pool"""
        with cls._pool_lock:
            if pool_id in cls._pools:
                pool = cls._pools.pop(pool_id)
                try:
                    if hasattr(pool, 'closeall'):
                        pool.closeall()
                    elif hasattr(pool, 'close'):
                        pool.close()
                except Exception as e:
                    logger.error(f"Error closing pool {pool_id}: {e}")
    
    @classmethod
    def close_all_pools(cls):
        """Close all connection pools"""
        pool_ids = list(cls._pools.keys())
        for pool_id in pool_ids:
            cls.close_pool(pool_id)


class SimplePool:
    """Simple connection pool for databases without native pooling"""
    
    def __init__(self, db_type: str, config: Dict, credentials: Dict, min_conn: int, max_conn: int):
        self.db_type = db_type
        self.config = config
        self.credentials = credentials
        self.min_conn = min_conn
        self.max_conn = max_conn
        self._available = []
        self._in_use = set()
        self._lock = Lock()
        
        # Initialize minimum connections
        for _ in range(min_conn):
            conn = self._create_connection()
            self._available.append(conn)
    
    def _create_connection(self):
        """Create a new database connection"""
        if self.db_type == 'mysql':
            import pymysql
            return pymysql.connect(
                host=self.config.get('host'),
                port=int(self.config.get('port', 3306)),
                database=self.config.get('database'),
                user=self.credentials.get('username'),
                password=self.credentials.get('password')
            )
        elif self.db_type == 'sqlserver':
            import pyodbc
            driver = self.config.get('driver', 'ODBC Driver 17 for SQL Server')
            conn_str = (
                f"DRIVER={{{driver}}};"
                f"SERVER={self.config.get('host')},{self.config.get('port', 1433)};"
                f"DATABASE={self.config.get('database')};"
                f"UID={self.credentials.get('username')};"
                f"PWD={self.credentials.get('password')};"
            )
            return pyodbc.connect(conn_str)
        else:
            raise DatabaseConnectionError(f"Unsupported database type for pooling: {self.db_type}")
    
    def getconn(self):
        """Get a connection from the pool"""
        with self._lock:
            if self._available:
                conn = self._available.pop()
                self._in_use.add(conn)
                return conn
            elif len(self._in_use) < self.max_conn:
                conn = self._create_connection()
                self._in_use.add(conn)
                return conn
            else:
                raise DatabasePoolExhaustedError(f"Connection pool exhausted (max: {self.max_conn})")
    
    def putconn(self, conn):
        """Return a connection to the pool"""
        with self._lock:
            if conn in self._in_use:
                self._in_use.remove(conn)
                self._available.append(conn)
    
    def closeall(self):
        """Close all connections in the pool"""
        with self._lock:
            for conn in self._available:
                try:
                    conn.close()
                except Exception as e:
                    logger.error(f"Error closing connection: {e}")
            for conn in self._in_use:
                try:
                    conn.close()
                except Exception as e:
                    logger.error(f"Error closing connection: {e}")
            self._available.clear()
            self._in_use.clear()


# ==================== Database Service ====================

class DatabaseService:
    """Service for testing and executing database connections"""
    
    SUPPORTED_TYPES = ['postgresql', 'mysql', 'sqlserver', 'oracle', 'odbc']
    
    # ==================== Connection Testing ====================
    
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
    
    # ==================== Query Execution ====================
    
    @staticmethod
    def execute_query(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str],
        query: str,
        params: Optional[Tuple] = None,
        timeout: int = 300
    ) -> List[Dict[str, Any]]:
        """
        Execute a SQL query and return results.
        
        Args:
            db_type: Database type
            config: Connection config
            credentials: Username and password
            query: SQL query to execute
            params: Optional query parameters for parameterized queries
            timeout: Query timeout in seconds (default: 300)
            
        Returns:
            List of dictionaries representing rows
        """
        with DatabaseService.get_connection(db_type, config, credentials) as conn:
            cursor = conn.cursor()
            
            try:
                # Set query timeout if supported
                DatabaseService._set_query_timeout(cursor, db_type, timeout)
                
                # Execute query
                start_time = time.time()
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                # Fetch results
                if cursor.description:  # SELECT query
                    columns = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchall()
                    
                    # Convert to list of dicts
                    results = []
                    for row in rows:
                        results.append(dict(zip(columns, row)))
                    
                    elapsed = time.time() - start_time
                    logger.info(f"Query executed in {elapsed:.2f}s, returned {len(results)} rows")
                    
                    return results
                else:  # INSERT/UPDATE/DELETE
                    conn.commit()
                    rowcount = cursor.rowcount
                    logger.info(f"Query executed, affected {rowcount} rows")
                    return [{"affected_rows": rowcount}]
                    
            except Exception as e:
                conn.rollback()
                logger.error(f"Query execution failed: {str(e)}")
                raise DatabaseQueryError(f"Query failed: {str(e)}")
            finally:
                cursor.close()
    
    @staticmethod
    def execute_query_stream(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str],
        query: str,
        params: Optional[Tuple] = None,
        chunk_size: int = 1000
    ) -> Generator[List[Dict[str, Any]], None, None]:
        """
        Execute a query and stream results in chunks (for large datasets).
        
        Args:
            db_type: Database type
            config: Connection config
            credentials: Username and password
            query: SQL query to execute
            params: Optional query parameters
            chunk_size: Number of rows per chunk
            
        Yields:
            Chunks of rows as list of dictionaries
        """
        with DatabaseService.get_connection(db_type, config, credentials) as conn:
            cursor = conn.cursor()
            
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                if not cursor.description:
                    raise DatabaseQueryError("Query did not return results")
                
                columns = [desc[0] for desc in cursor.description]
                
                while True:
                    rows = cursor.fetchmany(chunk_size)
                    if not rows:
                        break
                    
                    chunk = []
                    for row in rows:
                        chunk.append(dict(zip(columns, row)))
                    
                    yield chunk
                    
            except Exception as e:
                logger.error(f"Query streaming failed: {str(e)}")
                raise DatabaseQueryError(f"Query streaming failed: {str(e)}")
            finally:
                cursor.close()
    
    @staticmethod
    def _set_query_timeout(cursor, db_type: str, timeout: int):
        """Set query timeout based on database type"""
        try:
            if db_type == 'postgresql':
                cursor.execute(f"SET statement_timeout = {timeout * 1000};")  # milliseconds
            elif db_type == 'mysql':
                cursor.execute(f"SET max_execution_time = {timeout * 1000};")  # milliseconds
            elif db_type == 'sqlserver':
                # SQL Server uses connection timeout, set at connection level
                pass
            elif db_type == 'oracle':
                # Oracle timeout is typically set at session level
                pass
        except Exception as e:
            logger.warning(f"Could not set query timeout for {db_type}: {e}")
    
    # ==================== Connection Management ====================
    
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
                try:
                    import psycopg2
                    conn = psycopg2.connect(
                        host=config.get('host'),
                        port=config.get('port', 5432),
                        database=config.get('database'),
                        user=credentials.get('username'),
                        password=credentials.get('password'),
                        connect_timeout=30
                    )
                except ImportError:
                    raise DatabaseConnectionError("psycopg2 driver not installed")
            elif db_type == 'mysql':
                try:
                    import pymysql
                    conn = pymysql.connect(
                        host=config.get('host'),
                        port=int(config.get('port', 3306)),
                        database=config.get('database'),
                        user=credentials.get('username'),
                        password=credentials.get('password'),
                        connect_timeout=30
                    )
                except ImportError:
                    raise DatabaseConnectionError("pymysql driver not installed")
            elif db_type == 'sqlserver':
                try:
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
                except ImportError:
                    raise DatabaseConnectionError("pyodbc driver not installed")
            elif db_type == 'oracle':
                try:
                    import oracledb
                    dsn = f"{config.get('host')}:{config.get('port', 1521)}/{config.get('database')}"
                    conn = oracledb.connect(
                        user=credentials.get('username'),
                        password=credentials.get('password'),
                        dsn=dsn
                    )
                except ImportError:
                    raise DatabaseConnectionError("oracledb driver not installed")
            elif db_type == 'odbc':
                try:
                    import pyodbc
                    conn_str = config.get('connection_string', '')
                    conn_str = conn_str.replace('{username}', credentials.get('username', ''))
                    conn_str = conn_str.replace('{password}', credentials.get('password', ''))
                    conn = pyodbc.connect(conn_str)
                except ImportError:
                    raise DatabaseConnectionError("pyodbc driver not installed")
            else:
                raise DatabaseConnectionError(f"Unsupported database type: {db_type}")
            
            yield conn
            
        except DatabaseConnectionError:
            raise
        except Exception as e:
            logger.error(f"Failed to connect to {db_type}: {str(e)}")
            raise DatabaseConnectionError(f"Failed to connect to {db_type} database: {str(e)}")
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
    
    @staticmethod
    def check_connection_health(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str]
    ) -> bool:
        """
        Check if database connection is healthy.
        
        Returns:
            True if connection is healthy, False otherwise
        """
        try:
            result = DatabaseService.test_connection(db_type, config, credentials)
            return result.get('status') == 'success'
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    # ==================== Schema Discovery ====================
    
    @staticmethod
    def get_tables(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str],
        schema_filter: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        List all tables from a database connection.
        
        Args:
            db_type: Database type
            config: Connection config
            credentials: Username and password
            schema_filter: Optional schema/catalog filter
            
        Returns:
            List of dicts with schema, name, and type (table/view)
        """
        with DatabaseService.get_connection(db_type, config, credentials) as conn:
            cursor = conn.cursor()
            
            try:
                if db_type == 'postgresql':
                    query = """
                        SELECT table_schema, table_name, table_type
                        FROM information_schema.tables
                        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                    """
                    if schema_filter:
                        query += f" AND table_schema = '{schema_filter}'"
                    query += " ORDER BY table_schema, table_name"
                    
                elif db_type == 'mysql':
                    query = """
                        SELECT table_schema, table_name, table_type
                        FROM information_schema.tables
                        WHERE table_schema NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
                    """
                    if schema_filter:
                        query += f" AND table_schema = '{schema_filter}'"
                    query += " ORDER BY table_schema, table_name"
                    
                elif db_type == 'sqlserver':
                    query = """
                        SELECT s.name AS table_schema, t.name AS table_name,
                            CASE WHEN t.type = 'U' THEN 'BASE TABLE' ELSE 'VIEW' END AS table_type
                        FROM sys.tables t
                        JOIN sys.schemas s ON t.schema_id = s.schema_id
                    """
                    if schema_filter:
                        query += f" WHERE s.name = '{schema_filter}'"
                    query += " ORDER BY s.name, t.name"
                    
                elif db_type == 'oracle':
                    query = """
                        SELECT owner AS table_schema, table_name, 'BASE TABLE' AS table_type
                        FROM all_tables
                        WHERE owner NOT IN ('SYS', 'SYSTEM', 'CTXSYS', 'MDSYS', 'OLAPSYS', 'XDB')
                    """
                    if schema_filter:
                        query += f" AND owner = '{schema_filter.upper()}'"
                    query += " ORDER BY owner, table_name"
                    
                else:
                    # Generic ODBC fallback
                    query = """
                        SELECT table_schema, table_name, table_type
                        FROM information_schema.tables
                        ORDER BY table_schema, table_name
                    """
                
                cursor.execute(query)
                rows = cursor.fetchall()
                
                tables = []
                for row in rows:
                    tables.append({
                        "schema": row[0],
                        "name": row[1],
                        "type": row[2] if len(row) > 2 else "TABLE",
                        "full_name": f"{row[0]}.{row[1]}"
                    })
                
                return tables
                
            finally:
                cursor.close()
    
    @staticmethod
    def get_columns(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str],
        table_name: str,
        schema_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List all columns for a specific table.
        
        Args:
            db_type: Database type
            config: Connection config
            credentials: Username and password
            table_name: Name of the table
            schema_name: Optional schema name
            
        Returns:
            List of column info dicts
        """
        with DatabaseService.get_connection(db_type, config, credentials) as conn:
            cursor = conn.cursor()
            
            try:
                if db_type == 'postgresql':
                    query = """
                        SELECT 
                            column_name, 
                            data_type, 
                            is_nullable,
                            column_default,
                            character_maximum_length,
                            numeric_precision,
                            ordinal_position
                        FROM information_schema.columns
                        WHERE table_name = %s
                    """
                    params = [table_name]
                    if schema_name:
                        query += " AND table_schema = %s"
                        params.append(schema_name)
                    query += " ORDER BY ordinal_position"
                    cursor.execute(query, params)
                    
                elif db_type == 'mysql':
                    query = """
                        SELECT 
                            column_name, 
                            data_type, 
                            is_nullable,
                            column_default,
                            character_maximum_length,
                            numeric_precision,
                            ordinal_position
                        FROM information_schema.columns
                        WHERE table_name = %s
                    """
                    params = [table_name]
                    if schema_name:
                        query += " AND table_schema = %s"
                        params.append(schema_name)
                    query += " ORDER BY ordinal_position"
                    cursor.execute(query, params)
                    
                elif db_type == 'sqlserver':
                    query = """
                        SELECT 
                            c.name AS column_name,
                            t.name AS data_type,
                            CASE WHEN c.is_nullable = 1 THEN 'YES' ELSE 'NO' END AS is_nullable,
                            d.definition AS column_default,
                            c.max_length AS character_maximum_length,
                            c.precision AS numeric_precision,
                            c.column_id AS ordinal_position
                        FROM sys.columns c
                        JOIN sys.types t ON c.user_type_id = t.user_type_id
                        JOIN sys.tables tb ON c.object_id = tb.object_id
                        LEFT JOIN sys.default_constraints d ON c.default_object_id = d.object_id
                        WHERE tb.name = ?
                    """
                    if schema_name:
                        query += f"""
                            AND tb.schema_id = SCHEMA_ID('{schema_name}')
                        """
                    query += " ORDER BY c.column_id"
                    cursor.execute(query, (table_name,))
                    
                elif db_type == 'oracle':
                    query = """
                        SELECT 
                            column_name,
                            data_type,
                            nullable AS is_nullable,
                            data_default AS column_default,
                            data_length AS character_maximum_length,
                            data_precision AS numeric_precision,
                            column_id AS ordinal_position
                        FROM all_tab_columns
                        WHERE table_name = :1
                    """
                    if schema_name:
                        query += " AND owner = :2"
                        cursor.execute(query, (table_name.upper(), schema_name.upper()))
                    else:
                        cursor.execute(query, (table_name.upper(),))
                    query += " ORDER BY column_id"
                    
                else:
                    # Generic fallback
                    query = """
                        SELECT column_name, data_type, is_nullable, column_default,
                               character_maximum_length, numeric_precision, ordinal_position
                        FROM information_schema.columns
                        WHERE table_name = ?
                        ORDER BY ordinal_position
                    """
                    cursor.execute(query, (table_name,))
                
                rows = cursor.fetchall()
                
                columns = []
                for row in rows:
                    columns.append({
                        "name": row[0],
                        "type": row[1],
                        "nullable": row[2] == 'YES' or row[2] == 'Y' or row[2] == True,
                        "default": str(row[3]) if row[3] else None,
                        "max_length": row[4],
                        "precision": row[5],
                        "position": row[6]
                    })
                
                return columns
                
            finally:
                cursor.close()
    
    @staticmethod
    def preview_table(
        db_type: str,
        config: Dict[str, Any],
        credentials: Dict[str, str],
        table_name: str,
        schema_name: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get a preview of data from a table.
        
        Args:
            db_type: Database type
            config: Connection config
            credentials: Username and password
            table_name: Name of the table
            schema_name: Optional schema name
            limit: Max rows to return
            
        Returns:
            List of row dictionaries
        """
        # Build qualified table name
        if schema_name:
            qualified_name = f'"{schema_name}"."{table_name}"'
        else:
            qualified_name = f'"{table_name}"'
        
        # Build query based on database type
        if db_type == 'oracle':
            query = f"SELECT * FROM {qualified_name} WHERE ROWNUM <= {limit}"
        elif db_type == 'sqlserver':
            query = f"SELECT TOP {limit} * FROM {qualified_name}"
        else:
            query = f"SELECT * FROM {qualified_name} LIMIT {limit}"
        
        return DatabaseService.execute_query(db_type, config, credentials, query)

