from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database
    DATABASE_URL: str = "postgresql://openreg:openreg_dev_password@localhost:5432/openreg"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MinIO / S3
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_USE_SSL: bool = False
    ARTIFACT_BUCKET: str = "openreg-artifacts"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Encryption (Fernet key for credential encryption)
    ENCRYPTION_KEY: str = "SA3MG87YRp8ErWD-l7-tIQgMCM2kpD5fCl7F4VL3uB8="  # Valid 32-byte base64 key
    
    # Application
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # CORS - stored as comma-separated string from env
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as a list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
    
    # Celery - use REDIS_URL by default if not explicitly set
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    
    @property
    def celery_broker(self) -> str:
        """Get Celery broker URL, defaulting to REDIS_URL"""
        return self.CELERY_BROKER_URL or self.REDIS_URL
    
    @property
    def celery_backend(self) -> str:
        """Get Celery result backend URL, defaulting to REDIS_URL"""
        return self.CELERY_RESULT_BACKEND or self.REDIS_URL
    
    # Database Connection Pooling
    DB_POOL_MIN_CONNECTIONS: int = 2
    DB_POOL_MAX_CONNECTIONS: int = 10
    DB_POOL_TIMEOUT: int = 30  # seconds
    DB_QUERY_TIMEOUT: int = 300  # 5 minutes default
    DB_QUERY_CHUNK_SIZE: int = 1000  # rows per chunk for streaming
    
    # Code Execution Limits
    CODE_MAX_MEMORY_MB: int = 512
    CODE_MAX_EXECUTION_SECONDS: int = 300
    CODE_MAX_OUTPUT_SIZE_MB: int = 100
    CODE_MAX_LINES: int = 5000
    
    # Worker Limits
    WORKER_MAX_EXECUTION_TIME: int = 3600  # 1 hour max per job
    WORKER_MAX_MEMORY_MB: int = 2048  # 2GB max per worker
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
