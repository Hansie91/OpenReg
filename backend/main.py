from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import engine, Base
from config import settings
from api import auth, reports, connectors, mappings, validations, schedules, destinations, runs, admin, queries, exceptions

# Configure logging
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle management for FastAPI application"""
    # Startup
    logger.info("Starting OpenRegReport Portal...")
    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    
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

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker healthcheck"""
    return {"status": "healthy", "environment": settings.ENVIRONMENT}

# API Router Registration
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["Authentication"])
app.include_router(reports.router, prefix=f"{API_PREFIX}/reports", tags=["Reports"])
app.include_router(connectors.router, prefix=f"{API_PREFIX}/connectors", tags=["Connectors"])
app.include_router(queries.router, prefix=f"{API_PREFIX}/queries", tags=["Queries"])
app.include_router(mappings.router, prefix=f"{API_PREFIX}/mappings", tags=["Cross-Reference"])
app.include_router(validations.router, prefix=f"{API_PREFIX}/validations", tags=["Validations"])
app.include_router(exceptions.router, prefix=f"{API_PREFIX}/exceptions", tags=["Exceptions"])
app.include_router(schedules.router, prefix=f"{API_PREFIX}/schedules", tags=["Schedules"])
app.include_router(destinations.router, prefix=f"{API_PREFIX}/destinations", tags=["Destinations"])
app.include_router(runs.router, prefix=f"{API_PREFIX}/runs", tags=["Job Runs"])
app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["Administration"])


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
