"""
Encryption Service

Provides utilities for encrypting/decrypting sensitive data like database credentials.
"""

from cryptography.fernet import Fernet
from config import settings
import logging
import hashlib
import base64
import json

logger = logging.getLogger(__name__)


def get_cipher():
    """Get Fernet cipher instance using a derived key from SECRET_KEY"""
    # Derive a 32-byte key from SECRET_KEY using SHA-256
    key_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    # Fernet requires base64-encoded 32 bytes
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def decrypt_credentials(encrypted_credentials) -> dict:
    """
    Decrypt database credentials.
    
    Args:
        encrypted_credentials: Encrypted credentials (bytes)
        
    Returns:
        Dict with decrypted credentials
    """
    if encrypted_credentials is None:
        return {}
    
    cipher = get_cipher()
    
    # Handle bytes input (from LargeBinary column)
    if isinstance(encrypted_credentials, bytes):
        decrypted = cipher.decrypt(encrypted_credentials)
        return json.loads(decrypted.decode())
    
    # Handle dict input (legacy - shouldn't happen with new code)
    if isinstance(encrypted_credentials, dict):
        return {
            'username': cipher.decrypt(encrypted_credentials['username'].encode()).decode(),
            'password': cipher.decrypt(encrypted_credentials['password'].encode()).decode()
        }
    
    raise ValueError(f"Unsupported credential format: {type(encrypted_credentials)}")


def encrypt_credentials(credentials: dict) -> bytes:
    """
    Encrypt database credentials.
    
    Args:
        credentials: Dict with plaintext 'username' and 'password'
        
    Returns:
        Encrypted bytes for storage in LargeBinary column
    """
    cipher = get_cipher()
    
    # Serialize to JSON, then encrypt
    json_bytes = json.dumps(credentials).encode()
    return cipher.encrypt(json_bytes)

