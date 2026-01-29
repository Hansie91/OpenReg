# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Microservices with layered API design + async task queue orchestration

**Key Characteristics:**
- **Multi-service**: FastAPI-based main backend, separate external API service, customer portal frontend, internal admin frontend
- **Event-driven**: Celery task queue for async workflows, webhook system for event propagation
- **Layered**: Clear separation between API/routes, services/business logic, database models, and core utilities
- **State-driven**: Workflow state machine for report generation lifecycle with defined state transitions
- **Secure**: JWT tokens with refresh rotation, RBAC permissions, request context middleware, encrypted credentials

## Layers

**API Layer (Routes):**
- Purpose: HTTP endpoint definitions, request validation, response formatting
- Location: `backend/api/` (24 router modules) and `external_api/api/`
- Contains: FastAPI routers with Pydantic schemas, endpoint handlers
- Depends on: Service layer for business logic, database models, auth dependencies
- Used by: HTTP clients (frontend, external APIs), webhooks

**Service Layer (Business Logic):**
- Purpose: Core application logic, orchestration, data transformations, integrations
- Location: `backend/services/` (36 Python files organized by domain)
- Contains: Auth service, code generator, executor, connectors (PostgreSQL/SQL Server/Oracle/MySQL/ODBC), workflow state machine, external API client, delivery service, validation engine
- Depends on: Database models, core utilities (security, logging, exceptions), external libraries
- Used by: API routes, task workers, other services

**Workflow Orchestration Layer:**
- Purpose: Manage report generation execution state and step coordination
- Location: `backend/services/workflow/` (state machine, definitions, executor)
- Contains: WorkflowState enum (pending → initializing → fetching_data → pre_validation → transforming → post_validation → generating_artifacts → delivering → completed)
- Depends on: Service layer for step implementations, database for persistence
- Used by: Celery tasks, workflow API

**Task/Worker Layer (Async Processing):**
- Purpose: Execute long-running operations asynchronously via task queue
- Location: `backend/tasks/` (6 task modules: workflow, step, webhook, streaming, external_sync)
- Contains: Celery shared tasks registered in Celery broker (Redis), state persistence handlers
- Depends on: Service layer, workflow orchestration, database
- Used by: API triggers, scheduled jobs (cron), event callbacks

**Data Access Layer:**
- Purpose: Database operations via SQLAlchemy ORM
- Location: `backend/models.py` (monolithic model definitions)
- Contains: 20+ model classes (Report, ReportVersion, Connector, Validation, Schedule, Destination, User, etc.) with relationships
- Depends on: SQLAlchemy, database engine
- Used by: Services, tasks, API responses

**Core/Utility Layer:**
- Purpose: Cross-cutting concerns, security, logging, exception handling
- Location: `backend/core/` (logging, security, permissions, tenancy, exceptions)
- Contains: Structured logging config, JWT/password hashing, RBAC permission model, tenant isolation, custom exceptions
- Depends on: FastAPI, Python stdlib
- Used by: All other layers

**Middleware Layer:**
- Purpose: Request/response processing, rate limiting, context management
- Location: `backend/middleware/` (request context, rate limiting)
- Contains: Request ID tracking, tenant context injection, rate limit enforcement
- Depends on: FastAPI, Redis
- Used by: Main FastAPI app

**Frontend Layer (React/TypeScript):**
- Purpose: Admin UI for managing reports, connectors, schedules, workflows
- Location: `frontend/src/` (React components, pages, stores)
- Contains: Pages (Reports, Connectors, Runs, Dashboard), components (Layout, Wizard), API client with token refresh, Zustand store for auth
- Depends on: React Query, Axios, React Router, Tailwind CSS
- Used by: Browser, authenticated users

**External API Service:**
- Purpose: Read-only data service for external customers/partners
- Location: `external_api/` (separate FastAPI application)
- Contains: API key authentication, customer account management, read endpoints for reports/schemas/connectors/validations
- Depends on: Shared backend database, separate config
- Used by: External systems, customer integrations

**Customer Portal Frontend:**
- Purpose: Self-service portal for customers to manage API keys, view usage
- Location: `customer-portal/src/` (React components)
- Contains: Pages (Login, Dashboard, APIKeys, Signup)
- Depends on: React, Axios, local authentication
- Used by: Customer users

## Data Flow

**Report Execution (Main Workflow):**

1. User triggers report run via API: `POST /api/v1/reports/{id}/run`
2. API endpoint calls service layer to create JobRun record and enqueue workflow task
3. Celery task `execute_report_workflow` picks up job from Redis queue
4. WorkflowExecutor manages state transitions:
   - `PENDING` → `INITIALIZING`: Set up execution context
   - `INITIALIZING` → `FETCHING_DATA`: Query source database via Connector
   - `FETCHING_DATA` → `PRE_VALIDATION`: Run validation rules marked for pre_generation phase
   - `PRE_VALIDATION` → `TRANSFORMING`: Execute user Python code via sandboxed executor
   - `TRANSFORMING` → `POST_VALIDATION`: Run validation rules marked for pre_delivery phase
   - `POST_VALIDATION` → `GENERATING_ARTIFACTS`: Convert transformed data to XBRL/CSV/Excel
   - `GENERATING_ARTIFACTS` → `DELIVERING`: Send artifacts to configured destinations (SFTP/FTP)
   - `DELIVERING` → `COMPLETED`: Persist success state and notify
5. On error, transition to `FAILED` from any state with error message
6. Webhooks fired at state transitions if registered
7. Frontend polls `/api/v1/runs/{id}` for status, receives WebSocket updates if configured
8. Artifacts stored in MinIO S3-compatible object storage

**Authentication Flow:**

1. User submits credentials: `POST /api/v1/auth/login`
2. `auth` service hashes password, compares with DB
3. On match, generate JWT access token (15 min) + refresh token (7 days) with claims:
   - `iss` (issuer): "openreg"
   - `aud` (audience): "openreg-api"
   - `jti` (JWT ID): unique for revocation tracking
4. Tokens stored in Redis token store for revocation capability
5. Frontend stores access+refresh tokens in auth store (Zustand)
6. API interceptor adds `Authorization: Bearer <token>` header
7. On expiry (or before via timer), frontend calls `POST /api/v1/auth/refresh` with refresh token
8. Server validates refresh token, issues new access token (token rotation)
9. If refresh fails, user logged out
10. Middleware extracts user context from token, injects via `get_current_user` dependency

**External API Sync (Inbound Data):**

1. External regulatory API updates available (MiFIR, EMIR, etc.)
2. Scheduled task `sync_external_api` runs per `EXTERNAL_API_DEFAULT_SYNC_SCHEDULE` (daily 2 AM UTC)
3. `ExternalAPIClient` fetches schemas, reference data, validation rules
4. `ConflictResolver` merges remote data with local definitions (last-write-wins or preserves local)
5. `SchemaMismatchMapper` reconciles schema differences between sources
6. Updated data persisted to database
7. Frontend `/external-api` page shows sync history, last update timestamps

**Delivery Flow:**

1. After artifacts generated, DeliveryService picks them up
2. Iterates over configured Destinations (SFTP or FTP)
3. For each destination: establish connection, upload files, verify integrity
4. On success: mark FileSubmission as SUCCESS
5. On failure: retry with exponential backoff (configurable max retries)
6. Webhooks notified of delivery status

**State Management (Frontend):**

- **Auth Store (`authStore.ts`)**: Zustand store holding tokens, user info, login/logout actions
- **React Query**: Server state caching for API calls (reports, runs, connectors)
- **Inactivity Logout**: Monitors user activity, auto-logs out on timeout (per admin settings)

## Key Abstractions

**Connector:**
- Purpose: Abstract database connection interface supporting multiple engines
- Files: `backend/services/connectors/base.py`, `backend/services/connectors/factory.py`, `backend/services/connectors/postgresql.py`
- Pattern: Factory pattern + strategy pattern
- Implementations: PostgreSQL, SQL Server, Oracle, MySQL, ODBC via pyodbc

**ValidationEngine:**
- Purpose: Evaluate data validation rules (SQL-based and Python expression-based)
- Files: `backend/api/validations.py`, implied in validation service
- Pattern: Rule engine evaluating against data with severity levels (WARNING, BLOCKING, CORRECTABLE)
- Supports: Pre-generation and pre-delivery execution phases

**CodeGenerator:**
- Purpose: Generate Python transformation code from UI/API, validate syntax
- Files: `backend/services/code_generator.py`
- Pattern: Code template builder with AST validation

**Executor (Sandboxed):**
- Purpose: Execute user Python code safely with resource limits
- Files: `backend/services/executor.py`
- Pattern: RestrictedPython wrapper with signal-based timeouts, memory limits
- Allowed libs: pandas, numpy, lxml, openpyxl, datetime, dateutil, decimal, json, csv, re, math, statistics, xml
- Blocked: os, subprocess, socket, __import__, file operations

**WorkflowStateMachine:**
- Purpose: Enforce valid state transitions in report execution
- Files: `backend/services/workflow/state_machine.py`
- Pattern: State pattern with defined transition rules
- Ensures: No invalid transitions (e.g., can't go from COMPLETED to TRANSFORMING)

**LineageService:**
- Purpose: Track data flow from source connectors through transformations to outputs
- Files: `backend/services/lineage.py`, `backend/api/lineage.py`
- Pattern: Dependency graph builder
- Used by: Frontend LineageGraph component for visual DAG

**ExternalAPIClient:**
- Purpose: Fetch regulatory reference data from external sources
- Files: `backend/services/external_api/client.py`
- Pattern: HTTP client with retry logic, rate limiting, caching (TTL via Redis)
- Timeout: Configurable per environment (default 30s)
- Retries: Exponential backoff up to 3 attempts by default

**PermissionModel (RBAC):**
- Purpose: Grant granular resource:action permissions to users
- Files: `backend/core/permissions.py`
- Pattern: String-based resource:action pattern (e.g., "report:read", "schedule:execute")
- Wildcards: "report:*" grants all report actions, "*:*" grants admin
- Decorator: `@require_permissions(Permission.REPORT_CREATE)` protects endpoints

**TenancyIsolation:**
- Purpose: Multi-tenant support with automatic tenant context injection
- Files: `backend/core/tenancy.py`
- Pattern: Middleware injects tenant_id from token, services filter all queries by tenant
- Enforcement: Request context middleware adds tenant_id to SQLAlchemy session

## Entry Points

**Main Backend (`backend/main.py`):**
- Location: `backend/main.py`
- Triggers: `uvicorn` server startup
- Responsibilities:
  - Initialize FastAPI app with lifespan context manager
  - Validate database/Redis/MinIO connectivity at startup
  - Register 24 API routers (auth, reports, connectors, etc.)
  - Mount middleware (CORS, request context, rate limiting)
  - Return 503 if critical services unavailable

**External API (`external_api/main.py`):**
- Location: `external_api/main.py`
- Triggers: Separate `uvicorn` process (different port)
- Responsibilities:
  - Read-only API for external customers
  - API key authentication separate from main auth
  - Customer account/billing endpoints
  - Health check with database verification

**Frontend Entry (`frontend/src/main.tsx`):**
- Location: `frontend/src/main.tsx` → `App.tsx`
- Triggers: Browser page load
- Responsibilities:
  - Initialize React root
  - Set up QueryClient for React Query
  - Bootstrap Router with Layout
  - Hook inactivity logout, check session timeout

**Frontend App (`frontend/src/App.tsx`):**
- Routes: Login, Dashboard, Reports, Connectors, Runs, Mappings, Validations, Exceptions, Schedules, Destinations, Streaming, Admin, Schemas, ExternalAPI
- Protected: All routes except /login require `isAuthenticated` check
- Layout: Common header with logo, nav, user menu

**Customer Portal Entry (`customer-portal/src/main.tsx`):**
- Separate React app for customers
- Routes: Login, Signup, Dashboard, APIKeys
- Purpose: Self-service customer management

**Celery Worker Entry (`backend/tasks/__init__.py`):**
- Location: `backend/tasks/`
- Triggers: `celery -A tasks worker --loglevel=info`
- Responsibilities:
  - Pick up workflow tasks from Redis queue
  - Execute step handlers, persist state
  - Fire webhooks on state transitions
  - Retry failed steps with backoff

## Error Handling

**Strategy:** Structured exceptions with error codes, context propagation, logging at each layer

**Patterns:**

**API Layer:**
- Catch service exceptions, transform to HTTPException with status codes
- Return JSON error response with error_code and message
- Example: `TokenExpiredError` → 401 Unauthorized

**Service Layer:**
- Define custom exceptions in `core/exceptions.py`: `TokenExpiredError`, `TokenRevokedError`, `TokenInvalidError`, `PermissionDeniedError`, `ResourceNotFoundError`
- Raise with context (file, line, function)
- Let exceptions propagate to API layer for handling

**Task/Worker Layer:**
- Catch exceptions in step handlers, persist error_message and error_code to WorkflowExecution
- Transition to FAILED state with `failed_step` name
- Log full traceback via structured logger

**Frontend:**
- Axios response interceptor catches 401/403/500 errors
- 401 → logout, redirect to /login
- 403 → show permission denied alert
- 500 → show generic error with error_code if available

## Cross-Cutting Concerns

**Logging:**
- Framework: `core/logging.py` with Python `logging` module
- Format: Structured JSON in production, human-readable in dev
- Level: Configurable via `LOG_LEVEL` env var
- Includes: Request ID (for tracing), tenant ID, user ID, timestamp, level

**Validation:**
- Pydantic schemas in API routes validate request bodies, return 422 Unprocessable Entity on invalid input
- Database constraints enforce data integrity (foreign keys, unique constraints)
- Validation rules stored in DB, evaluated by ValidationEngine at report execution

**Authentication:**
- JWT tokens with claims validation (issuer, audience, expiry, revocation)
- Password hashing via bcrypt
- Credential encryption via Fernet for stored database passwords

**Authorization (RBAC):**
- Decorator `@require_permissions(Permission.X)` checks user has permission string
- Wildcard support: "report:*", "*:*"
- Tenant isolation: All queries filtered by tenant_id

**Rate Limiting:**
- Middleware enforces per-minute limits:
  - General: 60 requests/minute
  - Auth endpoints: 5 requests/minute (stricter)
  - Heavy operations: 10 requests/minute
- Uses Redis to track per-IP request counts
- Returns 429 Too Many Requests when exceeded

**Tenancy:**
- Multi-tenant support via tenant_id foreign key on all domain tables
- RequestContextMiddleware extracts tenant_id from JWT claims
- SQLAlchemy session scoped to tenant, all queries auto-filtered
- External API customers isolated by API key

**Tracing/Observability:**
- Request middleware generates unique request_id, logs at start/end
- Workflow execution tracked with progress_percentage updates
- State history stored on WorkflowExecution model
- Export for monitoring: Structured logs to stdout (consumed by ELK/Datadog)
