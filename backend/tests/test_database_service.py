"""
Unit tests for DatabaseService

Tests connection pooling, query execution, and error handling.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from services.database import (
    DatabaseService,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTimeoutError,
    ConnectionPoolManager,
    SimplePool
)


class TestConnectionTesting:
    """Test database connection testing methods"""
    
    def test_test_connection_postgresql_success(self):
        """Test successful PostgreSQL connection"""
        with patch('psycopg2.connect') as mock_connect:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.fetchone.return_value = ['PostgreSQL 14.0']
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn
            
            result = DatabaseService.test_connection(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'}
            )
            
            assert result['status'] == 'success'
            assert 'PostgreSQL' in result['metadata']['server_version']
    
    def test_test_connection_mysql_success(self):
        """Test successful MySQL connection"""
        with patch('pymysql.connect') as mock_connect:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.fetchone.return_value = ['8.0.28']
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn
            
            result = DatabaseService.test_connection(
                'mysql',
                {'host': 'localhost', 'port': 3306, 'database': 'test'},
                {'username': 'user', 'password': 'pass'}
            )
            
            assert result['status'] == 'success'
            assert 'MySQL' in result['metadata']['server_version']
    
    def test_test_connection_unsupported_type(self):
        """Test connection with unsupported database type"""
        result = DatabaseService.test_connection(
            'unsupported',
            {'host': 'localhost'},
            {'username': 'user', 'password': 'pass'}
        )
        
        assert result['status'] == 'error'
        assert 'Unsupported' in result['message']
    
    def test_test_connection_failure(self):
        """Test connection failure handling"""
        with patch('psycopg2.connect') as mock_connect:
            mock_connect.side_effect = Exception("Connection refused")
            
            result = DatabaseService.test_connection(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'}
            )
            
            assert result['status'] == 'error'


class TestQueryExecution:
    """Test query execution methods"""
    
    def test_execute_query_select(self):
        """Test SELECT query execution"""
        with patch('psycopg2.connect') as mock_connect:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.description = [('id',), ('name',)]
            mock_cursor.fetchall.return_value = [(1, 'Alice'), (2, 'Bob')]
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn
            
            results = DatabaseService.execute_query(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                'SELECT id, name FROM users'
            )
            
            assert len(results) == 2
            assert results[0]['id'] == 1
            assert results[0]['name'] == 'Alice'
            assert results[1]['id'] == 2
            assert results[1]['name'] == 'Bob'
    
    def test_execute_query_with_parameters(self):
        """Test parameterized query execution"""
        with patch('psycopg2.connect') as mock_connect:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.description = [('id',), ('name',)]
            mock_cursor.fetchall.return_value = [(1, 'Alice')]
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn
            
            results = DatabaseService.execute_query(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                'SELECT id, name FROM users WHERE id = %s',
                params=(1,)
            )
            
            mock_cursor.execute.assert_called_once()
            assert len(results) == 1
    
    def test_execute_query_insert(self):
        """Test INSERT query execution"""
        with patch('psycopg2.connect') as mock_connect:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.description = None
            mock_cursor.rowcount = 1
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn
            
            results = DatabaseService.execute_query(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                'INSERT INTO users (name) VALUES (%s)',
                params=('Charlie',)
            )
            
            assert results[0]['affected_rows'] == 1
            mock_conn.commit.assert_called_once()
    
    def test_execute_query_error(self):
        """Test query execution error handling"""
        with patch('psycopg2.connect') as mock_connect:
            mock_conn = Mock()
            mock_cursor = Mock()
            mock_cursor.execute.side_effect = Exception("Syntax error")
            mock_conn.cursor.return_value = mock_cursor
            mock_connect.return_value = mock_conn
            
            with pytest.raises(DatabaseQueryError):
                DatabaseService.execute_query(
                    'postgresql',
                    {'host': 'localhost', 'port': 5432, 'database': 'test'},
                    {'username': 'user', 'password': 'pass'},
                    'INVALID SQL'
                )
            
            mock_conn.rollback.assert_called_once()


class TestConnectionPooling:
    """Test connection pooling functionality"""
    
    def test_simple_pool_creation(self):
        """Test SimplePool creation"""
        with patch('pymysql.connect') as mock_connect:
            mock_connect.return_value = Mock()
            
            pool = SimplePool(
                'mysql',
                {'host': 'localhost', 'port': 3306, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                min_conn=2,
                max_conn=5
            )
            
            assert len(pool._available) == 2
            assert len(pool._in_use) == 0
    
    def test_simple_pool_get_connection(self):
        """Test getting connection from pool"""
        with patch('pymysql.connect') as mock_connect:
            mock_connect.return_value = Mock()
            
            pool = SimplePool(
                'mysql',
                {'host': 'localhost', 'port': 3306, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                min_conn=2,
                max_conn=5
            )
            
            conn = pool.getconn()
            assert conn is not None
            assert len(pool._available) == 1
            assert len(pool._in_use) == 1
    
    def test_simple_pool_return_connection(self):
        """Test returning connection to pool"""
        with patch('pymysql.connect') as mock_connect:
            mock_connect.return_value = Mock()
            
            pool = SimplePool(
                'mysql',
                {'host': 'localhost', 'port': 3306, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                min_conn=2,
                max_conn=5
            )
            
            conn = pool.getconn()
            pool.putconn(conn)
            
            assert len(pool._available) == 2
            assert len(pool._in_use) == 0
    
    def test_pool_manager_create_and_close(self):
        """Test ConnectionPoolManager create and close"""
        with patch('psycopg2.pool.SimpleConnectionPool') as mock_pool:
            mock_pool_instance = Mock()
            mock_pool.return_value = mock_pool_instance
            
            pool = ConnectionPoolManager.get_pool(
                'test-pool-1',
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'},
                {'min_connections': 2, 'max_connections': 10}
            )
            
            assert pool is not None
            
            ConnectionPoolManager.close_pool('test-pool-1')
            mock_pool_instance.closeall.assert_called_once()


class TestConnectionHealthCheck:
    """Test connection health checking"""
    
    def test_health_check_success(self):
        """Test successful health check"""
        with patch.object(DatabaseService, 'test_connection') as mock_test:
            mock_test.return_value = {'status': 'success'}
            
            result = DatabaseService.check_connection_health(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'}
            )
            
            assert result is True
    
    def test_health_check_failure(self):
        """Test failed health check"""
        with patch.object(DatabaseService, 'test_connection') as mock_test:
            mock_test.return_value = {'status': 'error'}
            
            result = DatabaseService.check_connection_health(
                'postgresql',
                {'host': 'localhost', 'port': 5432, 'database': 'test'},
                {'username': 'user', 'password': 'pass'}
            )
            
            assert result is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
