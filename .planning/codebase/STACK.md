# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- Python 3.10+ - Backend services, Celery workers, async APIs
- TypeScript 5.3+ - Frontend React applications
- SQL - Database schema and migrations

**Secondary:**
- JavaScript - Configuration and build tools (Vite, Node.js tooling)

## Runtime

**Environment:**
- Python 3.10+ (specified in `backend/pyproject.toml`)
- Node.js 18+ (implicit via npm/Vite in package.json)
- Docker containers for all services

**Package Manager:**
- pip - Python package management
- npm - Node.js dependencies (package.json)

## Frameworks

**Core Backend:**
- FastAPI 0.109.0 - Async REST API framework (`backend/requirements.txt`)
- Uvicorn 0.27.0 - ASGI server for FastAPI applications

**Frontend:**
- React 18.2.0 - UI library for both portals
- React Router DOM 6.21.1 - Client-side routing (`frontend/package.json`)
- Vite 5.0.11 - Development server and build tool
- TailwindCSS 3.4.1 - Utility-first CSS framework
- TypeScript 5.3.3 - Type-safe JavaScript

**Testing:**
- pytest 7.4.4 - Python unit and integration testing framework
- pytest-asyncio 0.23.3 - Async test support
- vitest 1.2.0 - JavaScript/TypeScript test runner (`frontend/package.json`)
- MSW 2.1.0 - Mock Service Worker for frontend testing
- @testing-library/react 14.2.0 - React component testing utilities

**Build/Dev:**
- Alembic 1.13.1 - Database migration tool
- Celery 5.3.6 - Distributed task queue for async job processing
- Redis 5.0.1 - In-memory broker for Celery and caching
- Autoprefixer 10.4.16 - PostCSS plugin for vendor prefixes
- PostCSS 8.4.33 - CSS transformation pipeline

## Key Dependencies

**Critical:**

**Backend:**
- SQLAlchemy 2.0.25 - ORM for database abstraction (`backend/requirements.txt`)
- Pydantic 2.5.3 - Data validation and serialization
- python-jose 3.3.0 - JWT token handling for authentication
- passlib 1.7.4 with bcrypt 4.1.2 - Password hashing and verification
- cryptography 42.0.0 - Encryption/decryption for sensitive data storage

**Infrastructure:**
- psycopg2-binary 2.9.9 - PostgreSQL adapter for Python
- asyncpg 0.29.0 - Async PostgreSQL driver for performance
- minio 7.2.3 - S3-compatible object storage client
- boto3 1.34.34 - AWS SDK for potential cloud integration
- redis 5.0.1 - Redis Python client for caching and Celery broker

**Data Processing:**
- pandas 2.1.4 - Tabular data manipulation for report execution
- numpy 1.26.3 - Numerical computing library
- openpyxl 3.1.2 - Excel file reading/writing for reports
- lxml 5.1.0 - XML/XBRL parsing support
- RestrictedPython 6.2 - Safe code execution for user-defined report logic
- defusedxml 0.7.1 - XML bomb prevention

**External Connectors:**
- pyodbc 5.0.1 - ODBC database connectivity
- pymysql 1.1.0 - MySQL driver
- cx-Oracle 8.3.0 - Oracle database driver
- oracledb 2.0.1 - Modern Oracle client
- paramiko 3.4.0 - SFTP/FTP file transfer protocol

**API & HTTP:**
- httpx 0.26.0 - Modern async HTTP client (used for external API integration)
- requests 2.31.0 - HTTP library for synchronous requests
- slowapi 0.1.9 - Rate limiting middleware for FastAPI

**Frontend:**
- axios 1.6.5 - HTTP client for API calls (`frontend/package.json`)
- react-query 3.39.3 - Server state management and caching
- zustand 4.4.7 - Lightweight state management
- ReactFlow 11.11.4 - Visual workflow/graph rendering
- @monaco-editor/react 4.6.0 - Embedded code editor for report configuration
- @stripe/stripe-js 2.3.0 - Stripe payment integration (`customer-portal/package.json`)
- lucide-react 0.300.0 - Icon library for UI

**Utilities:**
- python-dateutil 2.8.2 - Date/time utilities
- pytz 2024.1 - Timezone support
- croniter 2.0.1 - Cron expression parsing for job scheduling
- jsonschema 4.21.1 - JSON Schema validation
- date-fns 3.0.6 - Frontend date manipulation utilities

**Monitoring & Logging:**
- structlog 24.1.0 - Structured logging for JSON-formatted logs
- email-validator 2.1.0 - Email address validation

**Testing Tools:**
- pytest-cov 4.1.0 - Code coverage reporting
- @vitest/coverage-v8 - Code coverage for frontend tests
- jsdom 24.0.0 - DOM implementation for Node.js testing

## Configuration

**Environment:**
All services configured via environment variables (see `.env.example`):

**Critical Production Variables:**
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:pass@host:port/db`)
- `REDIS_URL` - Redis connection string (format: `redis://host:port/db`)
- `SECRET_KEY` - JWT signing key (must be ≥32 chars in production)
- `ENCRYPTION_KEY` - Fernet key for credential encryption (base64-encoded 32 bytes)
- `ENVIRONMENT` - Set to "production", "staging", or "development"
- `MINIO_ENDPOINT` - S3/MinIO endpoint (e.g., "minio:9000")
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key
- `STRIPE_SECRET_KEY` - Stripe API key for payments
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification secret
- `STRIPE_PRICE_ID` - Stripe price ID for subscriptions

**Optional Variables:**
- `VITE_API_URL` - Frontend API endpoint (default: http://localhost:8000)
- `CORS_ORIGINS` - Comma-separated allowed origins
- `LOG_LEVEL` - Logging verbosity (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `ARTIFACT_BUCKET` - MinIO bucket name for artifacts
- `POSTGRES_SSL_MODE` - SSL mode for database (production)
- `JWT_ALGORITHM` - JWT signing algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT expiration (default: 15 minutes)
- `REFRESH_TOKEN_EXPIRE_DAYS` - Refresh token TTL (default: 7 days)

**Build:**
- `frontend/tsconfig.json` - TypeScript compiler options with path aliases (`@/*` → `./src/*`)
- `frontend/vite.config.ts` - Vite build configuration (ES2020 target, React 18 JSX)
- `backend/pyproject.toml` - Python project metadata and pytest configuration
- `docker-compose.yml` - Multi-service orchestration with health checks

**Backend Configuration Loading:**
- `backend/config.py` - Pydantic BaseSettings for configuration validation
- `external_api/config.py` - Separate settings for external API service
- Configuration validation ensures production secrets are required, development has safe defaults

## Platform Requirements

**Development:**
- Docker and Docker Compose (for containerized services)
- Python 3.10+ with pip
- Node.js 18+ with npm
- PostgreSQL 15+ (or Docker image)
- Redis 7+ (or Docker image)
- MinIO (S3-compatible, or Docker image)

**Production:**
- Docker containers (all services containerized)
- PostgreSQL 15+ database (external or managed)
- Redis 7+ (external or managed)
- S3 or MinIO-compatible object storage
- Stripe account (for payment processing in external API)
- HTTPS/TLS certificates for encrypted traffic

**Architecture:**
- Multi-container Docker deployment defined in `docker-compose.yml`
- Main backend API (port 8000) with Uvicorn
- External API service (port 8001) with Uvicorn
- Frontend React app (port 3000)
- Customer portal React app (port 3001)
- Celery worker (background task execution)
- Celery Beat scheduler (periodic job scheduling)
- PostgreSQL, Redis, MinIO as supporting services
- All services connected via Docker network `openreg-network`

---

*Stack analysis: 2026-01-29*
