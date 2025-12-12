"""
Delivery Service for SFTP/FTP file transfers.

This module provides REAL network connections to external SFTP/FTP servers.
When you configure a destination and test the connection, it will:
1. Open a real TCP socket to the remote host
2. Authenticate with the provided credentials
3. Verify the directory exists
4. Optionally upload files to the remote server

This is NOT a simulation - these are actual network connections that can
transfer data to anywhere on the internet reachable from this server.

Uses:
- paramiko: Industry-standard SSH/SFTP library (same as what Ansible uses)
- ftplib: Python standard library for FTP connections
"""

import paramiko
import ftplib
import socket
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class DeliveryService:
    """Service for testing and executing file deliveries over SFTP/FTP."""
    
    @staticmethod
    def test_sftp_connection(
        host: str,
        port: int,
        username: str,
        password: str,
        directory: str = "/"
    ) -> dict:
        """
        Test SFTP connection to a remote server.
        
        This creates a REAL SSH connection using paramiko:
        1. Opens TCP socket to host:port
        2. Performs SSH handshake and key exchange
        3. Authenticates with username/password
        4. Opens SFTP channel
        5. Attempts to list the specified directory
        
        Args:
            host: Remote hostname or IP (e.g., "sftp.example.com")
            port: SSH port (typically 22)
            username: SSH username
            password: SSH password
            directory: Remote directory to verify exists
            
        Returns:
            dict with 'success' (bool) and 'message' (str)
        """
        transport = None
        sftp = None
        
        try:
            # Create SSH transport - this opens a REAL TCP connection
            transport = paramiko.Transport((host, port))
            transport.connect(username=username, password=password)
            
            # Open SFTP channel over the SSH connection
            sftp = paramiko.SFTPClient.from_transport(transport)
            
            # Verify the directory exists by listing it
            try:
                sftp.listdir(directory)
            except FileNotFoundError:
                return {
                    "success": False,
                    "message": f"Directory '{directory}' not found on remote server"
                }
            
            logger.info(f"SFTP connection successful to {host}:{port}")
            return {
                "success": True,
                "message": f"Connection successful! Directory '{directory}' is accessible."
            }
            
        except paramiko.AuthenticationException:
            return {
                "success": False,
                "message": "Authentication failed - check username and password"
            }
        except socket.gaierror:
            return {
                "success": False,
                "message": f"Could not resolve hostname: {host}"
            }
        except socket.timeout:
            return {
                "success": False,
                "message": f"Connection timed out to {host}:{port}"
            }
        except ConnectionRefusedError:
            return {
                "success": False,
                "message": f"Connection refused by {host}:{port}"
            }
        except Exception as e:
            logger.error(f"SFTP connection error: {e}")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}"
            }
        finally:
            if sftp:
                sftp.close()
            if transport:
                transport.close()
    
    @staticmethod
    def test_ftp_connection(
        host: str,
        port: int,
        username: str,
        password: str,
        directory: str = "/",
        use_tls: bool = False
    ) -> dict:
        """
        Test FTP/FTPS connection to a remote server.
        
        This creates a REAL FTP connection using Python's ftplib:
        1. Opens TCP socket to host:port
        2. Optionally upgrades to TLS (FTPS)
        3. Authenticates with username/password
        4. Changes to the specified directory
        
        Args:
            host: Remote hostname or IP
            port: FTP port (typically 21)
            username: FTP username
            password: FTP password
            directory: Remote directory to verify
            use_tls: If True, use FTPS (FTP over TLS)
            
        Returns:
            dict with 'success' (bool) and 'message' (str)
        """
        ftp = None
        
        try:
            # Create appropriate FTP class based on TLS setting
            if use_tls:
                ftp = ftplib.FTP_TLS()
            else:
                ftp = ftplib.FTP()
            
            # Connect - this opens a REAL TCP connection
            ftp.connect(host, port, timeout=30)
            
            # Upgrade to TLS if using FTPS
            if use_tls:
                ftp.prot_p()  # Enable data channel encryption
            
            # Authenticate
            ftp.login(username, password)
            
            # Verify directory exists
            try:
                ftp.cwd(directory)
            except ftplib.error_perm:
                return {
                    "success": False,
                    "message": f"Directory '{directory}' not found or inaccessible"
                }
            
            logger.info(f"FTP connection successful to {host}:{port}")
            return {
                "success": True,
                "message": f"Connection successful! Directory '{directory}' is accessible."
            }
            
        except ftplib.error_perm as e:
            return {
                "success": False,
                "message": f"Authentication failed: {str(e)}"
            }
        except socket.gaierror:
            return {
                "success": False,
                "message": f"Could not resolve hostname: {host}"
            }
        except socket.timeout:
            return {
                "success": False,
                "message": f"Connection timed out to {host}:{port}"
            }
        except ConnectionRefusedError:
            return {
                "success": False,
                "message": f"Connection refused by {host}:{port}"
            }
        except Exception as e:
            logger.error(f"FTP connection error: {e}")
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}"
            }
        finally:
            if ftp:
                try:
                    ftp.quit()
                except:
                    pass
    
    @staticmethod
    def upload_file_sftp(
        host: str,
        port: int,
        username: str,
        password: str,
        local_path: str,
        remote_path: str
    ) -> dict:
        """
        Upload a file to an SFTP server.
        
        This performs a REAL file transfer over the network.
        
        Args:
            host: Remote hostname
            port: SSH port
            username: SSH username
            password: SSH password
            local_path: Path to local file
            remote_path: Full path on remote server (including filename)
            
        Returns:
            dict with 'success' (bool) and 'message' (str)
        """
        transport = None
        sftp = None
        
        try:
            transport = paramiko.Transport((host, port))
            transport.connect(username=username, password=password)
            sftp = paramiko.SFTPClient.from_transport(transport)
            
            # Upload the file
            sftp.put(local_path, remote_path)
            
            # Verify upload by checking file size
            remote_stat = sftp.stat(remote_path)
            
            logger.info(f"Uploaded {local_path} to {host}:{remote_path} ({remote_stat.st_size} bytes)")
            return {
                "success": True,
                "message": f"File uploaded successfully ({remote_stat.st_size} bytes)"
            }
            
        except Exception as e:
            logger.error(f"SFTP upload error: {e}")
            return {
                "success": False,
                "message": f"Upload failed: {str(e)}"
            }
        finally:
            if sftp:
                sftp.close()
            if transport:
                transport.close()
    
    @staticmethod
    def upload_file_ftp(
        host: str,
        port: int,
        username: str,
        password: str,
        local_path: str,
        remote_path: str,
        use_tls: bool = False
    ) -> dict:
        """
        Upload a file to an FTP server.
        
        Args:
            host: Remote hostname
            port: FTP port
            username: FTP username
            password: FTP password
            local_path: Path to local file
            remote_path: Full path on remote server
            use_tls: Use FTPS
            
        Returns:
            dict with 'success' (bool) and 'message' (str)
        """
        ftp = None
        
        try:
            if use_tls:
                ftp = ftplib.FTP_TLS()
            else:
                ftp = ftplib.FTP()
            
            ftp.connect(host, port, timeout=30)
            
            if use_tls:
                ftp.prot_p()
            
            ftp.login(username, password)
            
            # Upload the file
            with open(local_path, 'rb') as f:
                ftp.storbinary(f'STOR {remote_path}', f)
            
            logger.info(f"Uploaded {local_path} to {host}:{remote_path}")
            return {
                "success": True,
                "message": "File uploaded successfully"
            }
            
        except Exception as e:
            logger.error(f"FTP upload error: {e}")
            return {
                "success": False,
                "message": f"Upload failed: {str(e)}"
            }
        finally:
            if ftp:
                try:
                    ftp.quit()
                except:
                    pass
