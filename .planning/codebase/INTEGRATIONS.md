# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Payment Processing:**
- Stripe - Payment collection and subscription management
  - SDK/Client: `stripe==8.0.0` (external_api/requirements.txt)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (env vars)
  - Webhook Secret: `STRIPE_WEBHOOK_SECRET` (env var)
  - Integration: `external_api/api/v1/customers/billing.py` - Handles checkout sessions, billing portal, subscriptions
  - Webhook Endpoint: `/webhook` receives events for checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_succeeded/failed
  - Client-side: `@stripe/stripe-js` in customer portal for payment form integration

**External Regulatory Data APIs:**
- Generic HTTP API client for regulatory data sources
  - SDK/Client: `httpx==0.26.0`, `requests==2.31.0` (backend/requirements.txt)
  - Implementation: `backend/services/external_api/client.py`
  - Auth Types: API Key, OAuth2, Basic authentication
  - Features: Exponential backoff retry logic, rate limiting, Redis response caching
  - Used for syncing reports, validation rules, reference data, and schedules

**Database Connectors (Multi-Source):**
- PostgreSQL (Primary metadata store)
  - Client: `psycopg2-binary==2.9.9`, `asyncpg==0.29.0`
  - Connection: Configured via `DATABASE_URL` environment variable
  - Used across all services for transactional data

- MySQL
  - Client: `pymysql==1.1.0`
  - Connector: `backend/services/connectors/postgresql.py` (base implementation)
  - Factory pattern in `backend/services/connectors/factory.py` for dynamic loading

- Oracle Database
  - Clients: `cx-Oracle==8.3.0`, `oracledb==2.0.1`
  - Supported for report data source connectivity

- ODBC-Compatible Databases
  - Client: `pyodbc==5.0.1`
  - Generic ODBC support for legacy systems

**File Transfer Protocols:**
- SFTP/FTP
  - Client: `paramiko==3.4.0`
  - Used in `backend/services/delivery.py` for artifact delivery

## Data Storage

**Databases:**

**PostgreSQL (Primary):**
- Provider: PostgreSQL 15 Alpine (Docker image)
- Connection: `DATABASE_URL=postgresql://user:password@postgres:5432/openreg`
- Client: SQLAlchemy 2.0.25 ORM with asyncpg async driver
- Purpose: Metadata, configuration, audit logs, reports, workflows, webhooks, customers
- Schema Management: Alembic migrations in `backend/alembic/versions/`
- Health Check: Built-in PostgreSQL health check in docker-compose.yml

**File Storage:**

**MinIO (S3-Compatible):**
- Service: S3-compatible object storage
- Connection: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- Client: `minio==7.2.3`
- Bucket: `ARTIFACT_BUCKET=openreg-artifacts` (configurable)
- Purpose: Storing generated reports, artifacts, processed files
- Implementation: `backend/services/storage.py` for S3/MinIO operations
- Web Console: Port 9001 for MinIO administration
- Health Check: LiveProbe endpoint in docker-compose.yml

**Caching:**

**Redis:**
- Service: Redis 7 Alpine (Docker image)
- Connection: `REDIS_URL=redis://redis:6379/0`
- Client: `redis==5.0.1` Python client
- Purpose:
  - Celery job queue and result backend
  - Response caching for external API calls (TTL configurable)
  - Rate limiting token bucket (slowapi middleware)
  - Session/token storage (optional)
- Implementation:
  - `backend/services/external_api/client.py` - ResponseCache and RateLimiter
  - `backend/middleware/rate_limit.py` - Rate limiting enforcement
- Health Check: Redis PING check in docker-compose.yml

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no external SSO)
  - Implementation: `backend/services/auth.py`
  - Token Generation: `backend/api/auth.py`
  - Algorithm: HS256 (configurable via `JWT_ALGORITHM`)
  - Secret: `SECRET_KEY` (Fernet-derived for encryption)
  - Token Expiration: `ACCESS_TOKEN_EXPIRE_MINUTES=15` (default)
  - Refresh Token TTL: `REFRESH_TOKEN_EXPIRE_DAYS=7` (default)
  - Issuer/Audience: `JWT_ISSUER=openreg`, `JWT_AUDIENCE=openreg-api`

**User Authentication:**
- Password hashing: bcrypt via passlib
- Encryption for stored credentials: Fernet symmetric encryption (`ENCRYPTION_KEY`)
- Used in: Admin users, tenant admins, report authors

**Customer Authentication (External API):**
- API Key-based authentication for external API customers
  - API Key generation: `external_api/api/v1/customers/billing.py`
  - Key format: `openreg_<random>` with SHA256 hash storage
  - Rate limiting: Per-customer rate limits stored and enforced via Redis
  - Implementation: `backend/services/api_keys.py`
  - Activation: Triggered on active Stripe subscription

**Credential Encryption:**
- Fernet symmetric encryption for storing connector credentials
- Key: `ENCRYPTION_KEY` (must be valid Fernet base64 key)
- Used for: Database passwords, API keys stored in database
- Validation: Base64 decoding and 32-byte length check in config

## Monitoring & Observability

**Error Tracking:**
- None detected - no external error tracking service (Sentry, Rollbar, etc.)
- Structured logging to stdout/stderr via structlog

**Logs:**
- Structured logging format: JSON (in production via `json_format=settings.ENVIRONMENT == "production"`)
- Framework: `structlog==24.1.0`
- Configuration: `backend/core/logging.py`
- Log Level: Configurable via `LOG_LEVEL` environment variable (default: INFO)
- Destination: stdout/stderr (Docker logs)

**Health Checks:**
- Startup health checks in `backend/main.py`:
  - Database connection validation
  - Redis connectivity check
  - MinIO bucket accessibility
  - Critical failures prevent startup in production
- Endpoint: `GET /health` on main backend API
- Endpoint: `GET /health` on external API service

## CI/CD & Deployment

**Hosting:**
- Docker containers (all services containerized)
- No specific cloud provider detected (cloud-agnostic Docker deployment)
- Supports deployment to any Docker-compatible platform (Docker Compose, Kubernetes, etc.)

**CI Pipeline:**
- Not detected in repository - no GitHub Actions, GitLab CI, or similar configuration found

**Build Process:**
- Dockerfiles for each service: `backend/Dockerfile`, `external_api/Dockerfile`, `frontend/Dockerfile`, `customer-portal/Dockerfile`
- Docker Compose for local development: `docker-compose.yml`
- Frontend build: TypeScript compilation + Vite bundling (`tsc && vite build`)
- Backend: Python package installation via requirements.txt

**Deployment Targets:**
- Docker containers via docker-compose.yml (development)
- Production: Docker images can be pushed to any registry (Docker Hub, ECR, GCR, etc.)

## Environment Configuration

**Required env vars for production deployment:**
```
ENVIRONMENT=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
MINIO_ENDPOINT=minio.example.com:9000
MINIO_ACCESS_KEY=access_key
MINIO_SECRET_KEY=secret_key
SECRET_KEY=<32+ character secure random string>
ENCRYPTION_KEY=<base64-encoded 32-byte Fernet key>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
CORS_ORIGINS=https://yourapp.com,https://admin.yourapp.com
VITE_API_URL=https://api.yourapp.com
LOG_LEVEL=INFO
```

**Secrets location:**
- Environment variables via `.env` file (development only)
- Environment variables from system/container environment (production)
- Docker secrets management (recommended for Kubernetes/Docker Swarm)
- No secrets committed to repository (`.env` is in `.gitignore`)

## Webhooks & Callbacks

**Incoming Webhooks:**

**Stripe Webhooks:**
- Endpoint: `POST /external_api/v1/customers/billing/webhook`
- Authentication: HMAC-SHA256 signature verification
- Headers: `Stripe-Signature` for HMAC verification
- Events handled:
  - `checkout.session.completed` - Payment successful, subscription being created
  - `customer.subscription.created` - New subscription active
  - `customer.subscription.updated` - Subscription status change
  - `customer.subscription.deleted` - Subscription cancelled
  - `invoice.payment_succeeded` - Recurring payment successful
  - `invoice.payment_failed` - Payment failure, status → PAST_DUE
- Handlers: `external_api/api/v1/customers/billing.py` (handle_* functions)
- Side Effects: Creates/updates Subscription records, activates API keys, deactivates on cancellation

**Custom Webhooks:**
- Endpoint Registration: `POST /webhooks` in `backend/api/webhooks.py`
- Events Supported: Job execution, artifact delivery, workflow state changes (WebhookEventType enum)
- Authentication: HMAC-SHA256 signature with custom headers:
  - `X-OpenReg-Signature` - sha256=hex_signature
  - `X-OpenReg-Timestamp` - Unix timestamp
  - `X-OpenReg-Event` - Event type
  - `X-OpenReg-Delivery` - Delivery ID
- Implementation: `backend/services/webhooks.py` with WebhookService
- Retry Policy: Configurable exponential backoff
- Filtering: By event type, report ID, allowed IPs

**Outgoing Webhooks:**
- Partner endpoints receive webhook POST requests with signed payloads
- Delivery Service: `backend/services/delivery.py`
- Async Task Queue: Celery tasks in `backend/tasks/webhook_tasks.py`
- Signature Verification: Partners must validate using shared secret

## External API Service

**Purpose:** Read-only API for external customers to access OpenReg data

**Authentication:** API key-based (per-customer keys)

**Rate Limiting:**
- Per-customer: Stored in `CustomerAPIKey.rate_limit_per_minute`
- Enforcement: Redis token bucket in `backend/services/external_api/client.py`
- Default: 100 requests/minute per customer
- Maximum: 2000 requests/minute (tiered pricing)

**Endpoints:** `external_api/api/v1/*`
- Reports API: Query and retrieve regulatory reports
- Validation Rules API: Access validation configurations
- Reference Data API: Lookup tables and reference information
- Billing API: Stripe checkout, portal, subscription management

**Response Caching:**
- Via Redis with configurable TTL (default 1 hour)
- Cache key: SHA256(URL + params)
- Used to reduce external API calls and database load

---

*Integration audit: 2026-01-29*
