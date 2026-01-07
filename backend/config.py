from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import List, Optional
import os
import warnings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Security-sensitive settings MUST be provided via environment variables
    in production. Development mode allows defaults but emits warnings.
    """

    # Environment - MUST be set explicitly
    ENVIRONMENT: str = "development"

    # Database - Required in production
    DATABASE_URL: Optional[str] = None

    # Redis - Required in production
    REDIS_URL: Optional[str] = None

    # MinIO / S3 - Required in production
    MINIO_ENDPOINT: Optional[str] = None
    MINIO_ACCESS_KEY: Optional[str] = None
    MINIO_SECRET_KEY: Optional[str] = None
    MINIO_USE_SSL: bool = False
    ARTIFACT_BUCKET: str = "openreg-artifacts"

    # Security - NEVER use defaults in production
    SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # JWT Claims - for token validation
    JWT_ISSUER: str = "openreg"
    JWT_AUDIENCE: str = "openreg-api"

    # Encryption (Fernet key for credential encryption) - Required in production
    ENCRYPTION_KEY: Optional[str] = None

    # Application
    LOG_LEVEL: str = "INFO"

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60  # Default requests per minute
    RATE_LIMIT_AUTH_PER_MINUTE: int = 5  # Auth endpoints (stricter)
    RATE_LIMIT_HEAVY_PER_MINUTE: int = 10  # Heavy operations

    # CORS - stored as comma-separated string from env
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Development mode defaults (only used when ENVIRONMENT=development)
    _DEV_DATABASE_URL: str = "postgresql://openreg:openreg_dev_password@localhost:5432/openreg"
    _DEV_REDIS_URL: str = "redis://localhost:6379/0"
    _DEV_MINIO_ENDPOINT: str = "localhost:9000"
    _DEV_MINIO_ACCESS_KEY: str = "minioadmin"
    _DEV_MINIO_SECRET_KEY: str = "minioadmin"
    _DEV_SECRET_KEY: str = "dev-only-secret-key-do-not-use-in-production-32chars"
    _DEV_ENCRYPTION_KEY: str = "SA3MG87YRp8ErWD-l7-tIQgMCM2kpD5fCl7F4VL3uB8="

    @model_validator(mode='after')
    def validate_and_apply_defaults(self):
        """Validate required settings and apply development defaults if needed."""
        is_production = self.ENVIRONMENT.lower() in ("production", "prod", "staging")
        errors = []

        # Required secrets for production
        required_secrets = [
            ("SECRET_KEY", "_DEV_SECRET_KEY"),
            ("ENCRYPTION_KEY", "_DEV_ENCRYPTION_KEY"),
            ("DATABASE_URL", "_DEV_DATABASE_URL"),
            ("REDIS_URL", "_DEV_REDIS_URL"),
            ("MINIO_ENDPOINT", "_DEV_MINIO_ENDPOINT"),
            ("MINIO_ACCESS_KEY", "_DEV_MINIO_ACCESS_KEY"),
            ("MINIO_SECRET_KEY", "_DEV_MINIO_SECRET_KEY"),
        ]

        for field_name, dev_default_name in required_secrets:
            value = getattr(self, field_name)
            dev_default = getattr(self, dev_default_name)

            if value is None or value == "":
                if is_production:
                    errors.append(f"{field_name} must be set via environment in production")
                else:
                    # Apply development default and warn
                    object.__setattr__(self, field_name, dev_default)
                    warnings.warn(
                        f"{field_name} not set, using development default. "
                        f"Set {field_name} environment variable for production.",
                        UserWarning,
                        stacklevel=2
                    )

        # Validate SECRET_KEY strength in production
        if is_production and self.SECRET_KEY:
            if len(self.SECRET_KEY) < 32:
                errors.append("SECRET_KEY must be at least 32 characters in production")
            weak_patterns = ["your-secret", "change-me", "default", "secret-key", "password"]
            if any(p in self.SECRET_KEY.lower() for p in weak_patterns):
                errors.append("SECRET_KEY appears to be a weak/default value")

        # Validate Fernet encryption key format
        if self.ENCRYPTION_KEY:
            import base64
            try:
                decoded = base64.urlsafe_b64decode(self.ENCRYPTION_KEY.encode())
                if len(decoded) != 32:
                    errors.append("ENCRYPTION_KEY must be a 32-byte base64-encoded Fernet key")
            except Exception:
                errors.append("ENCRYPTION_KEY is not a valid base64-encoded key")

        if errors:
            from core.exceptions import StartupValidationError
            raise StartupValidationError(errors)

        return self

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() in ("production", "prod", "staging")

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return not self.is_production
    
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

    # External API Sync Settings
    EXTERNAL_API_DEFAULT_TIMEOUT: int = 30  # HTTP request timeout in seconds
    EXTERNAL_API_MAX_RETRIES: int = 3  # Maximum retry attempts
    EXTERNAL_API_RETRY_BASE_DELAY: int = 2  # Base delay for exponential backoff
    EXTERNAL_API_CACHE_TTL: int = 3600  # Response cache TTL in seconds
    EXTERNAL_API_DEFAULT_SYNC_SCHEDULE: str = "0 2 * * *"  # Daily at 2 AM UTC
    EXTERNAL_API_RATE_LIMIT_PER_MINUTE: int = 60  # Default rate limit

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
