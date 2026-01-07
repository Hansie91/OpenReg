from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging
import time
import redis

from database import engine, Base, get_db
from config import settings
from api import auth, reports, connectors, mappings, validations, schedules, destinations, runs, admin, queries, exceptions, logs, submissions, schemas, dashboard, xbrl, delivery, streaming, lineage, api_keys, workflow, webhooks

# Configure logging
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


def check_database_connection() -> tuple[bool, str]:
    """Check if database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, "connected"
    except Exception as e:
        return False, str(e)


def check_redis_connection() -> tuple[bool, str]:
    """Check if Redis is reachable."""
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        r.close()
        return True, "connected"
    except Exception as e:
        return False, str(e)


def check_minio_connection() -> tuple[bool, str]:
    """Check if MinIO/S3 is reachable."""
    try:
        from minio import Minio
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL
        )
        # Check if bucket exists or can be accessed
        client.bucket_exists(settings.ARTIFACT_BUCKET)
        return True, "connected"
    except Exception as e:
        return False, str(e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle management for FastAPI application"""
    # Startup
    logger.info("Starting OpenRegReport Portal...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Validate critical dependencies at startup
    startup_errors = []

    # Check database
    db_ok, db_msg = check_database_connection()
    if db_ok:
        logger.info("Database connection: OK")
    else:
        logger.error(f"Database connection: FAILED - {db_msg}")
        startup_errors.append(f"Database: {db_msg}")

    # Check Redis
    redis_ok, redis_msg = check_redis_connection()
    if redis_ok:
        logger.info("Redis connection: OK")
    else:
        logger.warning(f"Redis connection: FAILED - {redis_msg}")
        # Redis is not critical for startup in development
        if settings.is_production:
            startup_errors.append(f"Redis: {redis_msg}")

    # Check MinIO
    minio_ok, minio_msg = check_minio_connection()
    if minio_ok:
        logger.info("MinIO connection: OK")
    else:
        logger.warning(f"MinIO connection: FAILED - {minio_msg}")
        # MinIO is not critical for startup in development
        if settings.is_production:
            startup_errors.append(f"MinIO: {minio_msg}")

    # In production, fail startup if critical services are unavailable
    if startup_errors and settings.is_production:
        error_msg = "Startup validation failed:\n" + "\n".join(f"  - {e}" for e in startup_errors)
        logger.critical(error_msg)
        raise RuntimeError(error_msg)

    # Create database tables (only if DB is connected)
    if db_ok:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")

    logger.info("OpenRegReport Portal started successfully")

    yield

    # Shutdown
    logger.info("Shutting down OpenRegReport Portal...")


app = FastAPI(
    title="OpenRegReport Portal API",
    description="Open-source regulatory reporting platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint (liveness probe)
@app.get("/health")
async def health_check():
    """
    Liveness probe - checks if the service is running.
    Used by Docker/Kubernetes to determine if the container should be restarted.
    """
    return {"status": "healthy", "environment": settings.ENVIRONMENT}


# Readiness probe endpoint
@app.get("/ready")
async def readiness_check():
    """
    Readiness probe - checks if the service can handle requests.
    Verifies database, Redis, and MinIO connectivity.
    Returns 503 if any critical service is unavailable.
    """
    checks = {}
    all_ok = True

    # Database check with latency
    start = time.time()
    db_ok, db_msg = check_database_connection()
    db_latency = round((time.time() - start) * 1000, 2)
    checks["database"] = {
        "status": "ok" if db_ok else "error",
        "latency_ms": db_latency if db_ok else None,
        "error": None if db_ok else db_msg
    }
    if not db_ok:
        all_ok = False

    # Redis check with latency
    start = time.time()
    redis_ok, redis_msg = check_redis_connection()
    redis_latency = round((time.time() - start) * 1000, 2)
    checks["redis"] = {
        "status": "ok" if redis_ok else "error",
        "latency_ms": redis_latency if redis_ok else None,
        "error": None if redis_ok else redis_msg
    }
    if not redis_ok:
        all_ok = False

    # MinIO check with latency
    start = time.time()
    minio_ok, minio_msg = check_minio_connection()
    minio_latency = round((time.time() - start) * 1000, 2)
    checks["storage"] = {
        "status": "ok" if minio_ok else "error",
        "latency_ms": minio_latency if minio_ok else None,
        "error": None if minio_ok else minio_msg
    }
    if not minio_ok:
        all_ok = False

    response_data = {
        "status": "ready" if all_ok else "not_ready",
        "environment": settings.ENVIRONMENT,
        "checks": checks
    }

    status_code = 200 if all_ok else 503
    return JSONResponse(content=response_data, status_code=status_code)

# API Router Registration
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["Authentication"])
app.include_router(api_keys.router, prefix=f"{API_PREFIX}/api-keys", tags=["API Keys"])
app.include_router(reports.router, prefix=f"{API_PREFIX}/reports", tags=["Reports"])
app.include_router(connectors.router, prefix=f"{API_PREFIX}/connectors", tags=["Connectors"])
app.include_router(queries.router, prefix=f"{API_PREFIX}/queries", tags=["Queries"])
app.include_router(mappings.router, prefix=f"{API_PREFIX}/mappings", tags=["Cross-Reference"])
app.include_router(validations.router, prefix=f"{API_PREFIX}/validations", tags=["Validations"])
app.include_router(exceptions.router, prefix=f"{API_PREFIX}/exceptions", tags=["Exceptions"])
app.include_router(schedules.router, prefix=f"{API_PREFIX}/schedules", tags=["Schedules"])
app.include_router(destinations.router, prefix=f"{API_PREFIX}/destinations", tags=["Destinations"])
app.include_router(delivery.router, prefix=f"{API_PREFIX}/delivery", tags=["Delivery"])
app.include_router(runs.router, prefix=f"{API_PREFIX}/runs", tags=["Job Runs"])
app.include_router(logs.router, prefix=f"{API_PREFIX}/runs", tags=["Log Streaming"])
app.include_router(submissions.router, prefix=f"{API_PREFIX}/submissions", tags=["Submissions"])
app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["Administration"])
app.include_router(schemas.router, prefix=f"{API_PREFIX}/schemas", tags=["Schemas"])
app.include_router(dashboard.router, prefix=f"{API_PREFIX}/dashboard", tags=["Dashboard"])
app.include_router(xbrl.router, prefix=f"{API_PREFIX}/xbrl", tags=["XBRL Taxonomies"])
app.include_router(streaming.router, prefix=f"{API_PREFIX}", tags=["Streaming"])
app.include_router(lineage.router, prefix=f"{API_PREFIX}/lineage", tags=["Data Lineage"])
app.include_router(workflow.router, prefix=f"{API_PREFIX}/workflow", tags=["Workflow"])
app.include_router(webhooks.router, prefix=f"{API_PREFIX}/webhooks", tags=["Webhooks"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OpenRegReport Portal API",
        "version": "0.1.0-beta",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
