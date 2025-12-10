"""
Storage service for artifact management using MinIO/S3
"""

from minio import Minio
from minio.error import S3Error
from io import BytesIO
import hashlib
from typing import BinaryIO, Tuple
import logging

from config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Service for managing artifact storage in MinIO/S3"""
    
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL
        )
        self.bucket = settings.ARTIFACT_BUCKET
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
                
                # Enable versioning for immutability
                # Note: MinIO versioning requires specific configuration
                # For MVP, we rely on append-only pattern
        except S3Error as e:
            logger.error(f"Error ensuring bucket exists: {e}")
    
    def upload_artifact(
        self,
        file_data: bytes,
        object_name: str,
        content_type: str = "application/octet-stream"
    ) -> Tuple[str, str, int]:
        """
        Upload an artifact to storage.
        
        Returns:
            Tuple of (storage_uri, checksum_sha256, size_bytes)
        """
        # Calculate checksum
        checksum = hashlib.sha256(file_data).hexdigest()
        size = len(file_data)
        
        # Upload to MinIO
        try:
            self.client.put_object(
                self.bucket,
                object_name,
                BytesIO(file_data),
                size,
                content_type=content_type
            )
            
            storage_uri = f"s3://{self.bucket}/{object_name}"
            logger.info(f"Uploaded artifact: {storage_uri}, size: {size} bytes")
            
            return storage_uri, checksum, size
        
        except S3Error as e:
            logger.error(f"Error uploading artifact: {e}")
            raise
    
    def download_artifact(self, object_name: str) -> bytes:
        """Download an artifact from storage"""
        try:
            response = self.client.get_object(self.bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"Error downloading artifact: {e}")
            raise
    
    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        """Get a presigned URL for downloading an artifact"""
        try:
            from datetime import timedelta
            url = self.client.presigned_get_object(
                self.bucket,
                object_name,
                expires=timedelta(seconds=expires_seconds)
            )
            return url
        except S3Error as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise
    
    def delete_artifact(self, object_name: str):
        """Delete an artifact (use with caution in production)"""
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"Deleted artifact: {object_name}")
        except S3Error as e:
            logger.error(f"Error deleting artifact: {e}")
            raise


# Singleton instance
storage_service = StorageService()
