"""
Unit tests for Delivery Service.

Tests SFTP and FTP file delivery with mocked network connections.
"""

import pytest
import socket
from unittest.mock import Mock, patch, MagicMock
import paramiko
import ftplib

from services.delivery import DeliveryService


class TestSFTPConnectionTest:
    """Tests for SFTP connection testing."""

    @patch('services.delivery.paramiko.Transport')
    @patch('services.delivery.paramiko.SFTPClient')
    def test_sftp_connection_success(self, mock_sftp_client, mock_transport):
        """Successful SFTP connection should return success status."""
        # Setup mocks
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        mock_sftp_instance = MagicMock()
        mock_sftp_instance.listdir.return_value = ['file1.txt', 'file2.txt']
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        result = DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass",
            directory="/uploads"
        )

        assert result["success"] is True
        assert "successful" in result["message"].lower()
        mock_transport.assert_called_once_with(("sftp.example.com", 22))
        mock_transport_instance.connect.assert_called_once_with(
            username="testuser",
            password="testpass"
        )

    @patch('services.delivery.paramiko.Transport')
    def test_sftp_authentication_failure(self, mock_transport):
        """Authentication failure should return error status."""
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance
        mock_transport_instance.connect.side_effect = paramiko.AuthenticationException()

        result = DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="baduser",
            password="badpass"
        )

        assert result["success"] is False
        assert "authentication" in result["message"].lower()

    @patch('services.delivery.paramiko.Transport')
    def test_sftp_connection_refused(self, mock_transport):
        """Connection refused should return error status."""
        mock_transport.side_effect = ConnectionRefusedError()

        result = DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass"
        )

        assert result["success"] is False
        assert "refused" in result["message"].lower()

    @patch('services.delivery.paramiko.Transport')
    def test_sftp_hostname_resolution_failure(self, mock_transport):
        """DNS resolution failure should return error status."""
        mock_transport.side_effect = socket.gaierror(8, "Name or service not known")

        result = DeliveryService.test_sftp_connection(
            host="invalid.hostname.example",
            port=22,
            username="testuser",
            password="testpass"
        )

        assert result["success"] is False
        assert "resolve" in result["message"].lower()

    @patch('services.delivery.paramiko.Transport')
    def test_sftp_connection_timeout(self, mock_transport):
        """Connection timeout should return error status."""
        mock_transport.side_effect = socket.timeout()

        result = DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass"
        )

        assert result["success"] is False
        assert "timed out" in result["message"].lower()

    @patch('services.delivery.paramiko.Transport')
    @patch('services.delivery.paramiko.SFTPClient')
    def test_sftp_directory_not_found(self, mock_sftp_client, mock_transport):
        """Directory not found should return error status."""
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        mock_sftp_instance = MagicMock()
        mock_sftp_instance.listdir.side_effect = FileNotFoundError()
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        result = DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass",
            directory="/nonexistent"
        )

        assert result["success"] is False
        assert "not found" in result["message"].lower()


class TestSFTPUpload:
    """Tests for SFTP file upload."""

    @patch('services.delivery.paramiko.Transport')
    @patch('services.delivery.paramiko.SFTPClient')
    def test_sftp_upload_success(self, mock_sftp_client, mock_transport):
        """Successful file upload should return success status."""
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        mock_sftp_instance = MagicMock()
        mock_stat = MagicMock()
        mock_stat.st_size = 1024
        mock_sftp_instance.stat.return_value = mock_stat
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        result = DeliveryService.upload_file_sftp(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass",
            local_path="/tmp/report.xml",
            remote_path="/uploads/report.xml"
        )

        assert result["success"] is True
        assert "1024" in result["message"]  # File size in message
        mock_sftp_instance.put.assert_called_once_with(
            "/tmp/report.xml",
            "/uploads/report.xml"
        )

    @patch('services.delivery.paramiko.Transport')
    @patch('services.delivery.paramiko.SFTPClient')
    def test_sftp_upload_local_file_not_found(self, mock_sftp_client, mock_transport):
        """Upload with missing local file should return error."""
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        mock_sftp_instance = MagicMock()
        mock_sftp_instance.put.side_effect = FileNotFoundError("Local file not found")
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        result = DeliveryService.upload_file_sftp(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass",
            local_path="/nonexistent/file.xml",
            remote_path="/uploads/file.xml"
        )

        assert result["success"] is False
        assert "failed" in result["message"].lower()

    @patch('services.delivery.paramiko.Transport')
    def test_sftp_upload_connection_error(self, mock_transport):
        """Upload with connection error should return error."""
        mock_transport.side_effect = ConnectionRefusedError()

        result = DeliveryService.upload_file_sftp(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass",
            local_path="/tmp/report.xml",
            remote_path="/uploads/report.xml"
        )

        assert result["success"] is False
        assert "failed" in result["message"].lower()


class TestFTPConnectionTest:
    """Tests for FTP connection testing."""

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_connection_success(self, mock_ftp_class):
        """Successful FTP connection should return success status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance

        result = DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            directory="/uploads",
            use_tls=False
        )

        assert result["success"] is True
        assert "successful" in result["message"].lower()
        mock_ftp_instance.connect.assert_called_once_with("ftp.example.com", 21, timeout=30)
        mock_ftp_instance.login.assert_called_once_with("testuser", "testpass")
        mock_ftp_instance.cwd.assert_called_once_with("/uploads")

    @patch('services.delivery.ftplib.FTP_TLS')
    def test_ftps_connection_success(self, mock_ftp_tls_class):
        """Successful FTPS connection should return success status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_tls_class.return_value = mock_ftp_instance

        result = DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            directory="/uploads",
            use_tls=True
        )

        assert result["success"] is True
        mock_ftp_instance.prot_p.assert_called_once()  # TLS protection enabled

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_authentication_failure(self, mock_ftp_class):
        """Authentication failure should return error status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.login.side_effect = ftplib.error_perm("530 Login incorrect")

        result = DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="baduser",
            password="badpass"
        )

        assert result["success"] is False
        assert "authentication" in result["message"].lower() or "530" in result["message"]

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_connection_refused(self, mock_ftp_class):
        """Connection refused should return error status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.connect.side_effect = ConnectionRefusedError()

        result = DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass"
        )

        assert result["success"] is False
        assert "refused" in result["message"].lower()

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_hostname_resolution_failure(self, mock_ftp_class):
        """DNS resolution failure should return error status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.connect.side_effect = socket.gaierror(8, "Name or service not known")

        result = DeliveryService.test_ftp_connection(
            host="invalid.hostname.example",
            port=21,
            username="testuser",
            password="testpass"
        )

        assert result["success"] is False
        assert "resolve" in result["message"].lower()

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_connection_timeout(self, mock_ftp_class):
        """Connection timeout should return error status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.connect.side_effect = socket.timeout()

        result = DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass"
        )

        assert result["success"] is False
        assert "timed out" in result["message"].lower()

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_directory_not_found(self, mock_ftp_class):
        """Directory not found should return error status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.cwd.side_effect = ftplib.error_perm("550 Directory not found")

        result = DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            directory="/nonexistent"
        )

        assert result["success"] is False
        assert "not found" in result["message"].lower() or "inaccessible" in result["message"].lower()


class TestFTPUpload:
    """Tests for FTP file upload."""

    @patch('services.delivery.ftplib.FTP')
    @patch('builtins.open', create=True)
    def test_ftp_upload_success(self, mock_open, mock_ftp_class):
        """Successful file upload should return success status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance

        mock_file = MagicMock()
        mock_open.return_value.__enter__.return_value = mock_file

        result = DeliveryService.upload_file_ftp(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            local_path="/tmp/report.xml",
            remote_path="/uploads/report.xml",
            use_tls=False
        )

        assert result["success"] is True
        assert "successfully" in result["message"].lower()
        mock_ftp_instance.storbinary.assert_called_once()

    @patch('services.delivery.ftplib.FTP_TLS')
    @patch('builtins.open', create=True)
    def test_ftps_upload_success(self, mock_open, mock_ftp_tls_class):
        """Successful FTPS upload should return success status."""
        mock_ftp_instance = MagicMock()
        mock_ftp_tls_class.return_value = mock_ftp_instance

        mock_file = MagicMock()
        mock_open.return_value.__enter__.return_value = mock_file

        result = DeliveryService.upload_file_ftp(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            local_path="/tmp/report.xml",
            remote_path="/uploads/report.xml",
            use_tls=True
        )

        assert result["success"] is True
        mock_ftp_instance.prot_p.assert_called_once()  # TLS protection enabled

    @patch('services.delivery.ftplib.FTP')
    @patch('builtins.open', create=True)
    def test_ftp_upload_local_file_not_found(self, mock_open, mock_ftp_class):
        """Upload with missing local file should return error."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance

        mock_open.side_effect = FileNotFoundError("No such file or directory")

        result = DeliveryService.upload_file_ftp(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            local_path="/nonexistent/file.xml",
            remote_path="/uploads/file.xml"
        )

        assert result["success"] is False
        assert "failed" in result["message"].lower()

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_upload_connection_error(self, mock_ftp_class):
        """Upload with connection error should return error."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.connect.side_effect = ConnectionRefusedError()

        result = DeliveryService.upload_file_ftp(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass",
            local_path="/tmp/report.xml",
            remote_path="/uploads/report.xml"
        )

        assert result["success"] is False
        assert "failed" in result["message"].lower()


class TestConnectionCleanup:
    """Tests for proper connection cleanup."""

    @patch('services.delivery.paramiko.Transport')
    @patch('services.delivery.paramiko.SFTPClient')
    def test_sftp_connection_cleanup_on_success(self, mock_sftp_client, mock_transport):
        """SFTP connections should be closed after successful test."""
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        mock_sftp_instance = MagicMock()
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass"
        )

        mock_sftp_instance.close.assert_called_once()
        mock_transport_instance.close.assert_called_once()

    @patch('services.delivery.paramiko.Transport')
    @patch('services.delivery.paramiko.SFTPClient')
    def test_sftp_connection_cleanup_on_error(self, mock_sftp_client, mock_transport):
        """SFTP connections should be closed even on error."""
        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance

        mock_sftp_instance = MagicMock()
        mock_sftp_instance.listdir.side_effect = Exception("Unexpected error")
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        DeliveryService.test_sftp_connection(
            host="sftp.example.com",
            port=22,
            username="testuser",
            password="testpass"
        )

        mock_sftp_instance.close.assert_called_once()
        mock_transport_instance.close.assert_called_once()

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_connection_cleanup_on_success(self, mock_ftp_class):
        """FTP connections should be closed after successful test."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance

        DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass"
        )

        mock_ftp_instance.quit.assert_called_once()

    @patch('services.delivery.ftplib.FTP')
    def test_ftp_connection_cleanup_on_error(self, mock_ftp_class):
        """FTP connections should be closed even on error."""
        mock_ftp_instance = MagicMock()
        mock_ftp_class.return_value = mock_ftp_instance
        mock_ftp_instance.cwd.side_effect = Exception("Unexpected error")

        DeliveryService.test_ftp_connection(
            host="ftp.example.com",
            port=21,
            username="testuser",
            password="testpass"
        )

        mock_ftp_instance.quit.assert_called_once()
