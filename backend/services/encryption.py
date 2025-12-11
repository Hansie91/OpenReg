"""
Encryption Service

Provides utilities for encrypting/decrypting sensitive data like database credentials.
"""

from cryptography.fernet import Fernet
from config import settings
import logging

logger = logging.getLogger(__name__)


def get_cipher():
    """Get Fernet cipher instance"""
    return Fernet(settings.SECRET_KEY.encode()[:44] + b'=')  # Fernet requires 44 chars


def decrypt_credentials(encrypted_credentials) -> dict:
    """
    Decrypt database credentials.
    
    Args:
        encrypted_credentials: Encrypted credentials (bytes or dict with encrypted fields)
        
    Returns:
        Dict with decrypted credentials
    """
    cipher = get_cipher()
    
    # Handle bytes input (from auth.py pattern)
    if isinstance(encrypted_credentials, bytes):
        import json
        decrypted = cipher.decrypt(encrypted_credentials)
        return json.loads(decrypted.decode())
    
    # Handle dict input (field-by-field encryption)
    if isinstance(encrypted_credentials, dict):
        return {
            'username': cipher.decrypt(encrypted_credentials['username'].encode()).decode(),
            'password': cipher.decrypt(encrypted_credentials['password'].encode()).decode()
        }
    
    raise ValueError(f"Unsupported credential format: {type(encrypted_credentials)}")


def encrypt_credentials(credentials: dict) -> dict:
    """
    Encrypt database credentials.
    
    Args:
        credentials: Dict with plaintext 'username' and 'password'
        
    Returns:
        Dict with encrypted credentials
    """
    cipher = get_cipher()
    
    return {
        'username': cipher.encrypt(credentials['username'].encode()).decode(),
        'password': cipher.encrypt(credentials['password'].encode()).decode()
    }
