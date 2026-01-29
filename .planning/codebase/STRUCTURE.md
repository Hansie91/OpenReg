# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
OpenReg/
├── backend/                    # Main Python FastAPI application (port 8000)
│   ├── api/                    # API route handlers (24 routers)
│   ├── services/               # Business logic services (36 modules)
│   ├── core/                   # Cross-cutting utilities (logging, security, perms)
│   ├── middleware/             # Request processing (context, rate limiting)
│   ├── tasks/                  # Celery async tasks (6 task modules)
│   ├── tests/                  # Unit and integration tests
│   ├── alembic/                # Database migrations
│   ├── scripts/                # Utility scripts (db setup, data loading)
│   ├── models.py               # SQLAlchemy ORM models (all domains in one file)
│   ├── database.py             # SQLAlchemy engine and session setup
│   ├── config.py               # Settings from environment variables
│   ├── main.py                 # FastAPI app entry point (lifespan, middleware, routers)
│   ├── init_db.py              # Database initialization script
│   └── pyproject.toml          # Python dependencies and pytest config
│
├── external_api/               # Separate FastAPI service for read-only data access
│   ├── api/                    # API routes (schemas, connectors, validations, etc.)
│   ├── api/v1/customers/       # Customer-specific endpoints (auth, billing, keys)
│   ├── core/                   # Security, dependencies, exceptions, rate limiting
│   ├── schemas/                # Pydantic schemas for external API
│   ├── models.py               # Models for external API (may share backend DB)
│   ├── database.py             # SQLAlchemy setup
│   ├── config.py               # External API configuration
│   └── main.py                 # FastAPI app entry point
│
├── frontend/                   # Admin UI (React + TypeScript)
│   ├── src/
│   │   ├── pages/              # Page components (Reports, Connectors, Runs, Dashboard, etc.)
│   │   ├── components/         # Reusable components (Layout, Wizard, LineageGraph, etc.)
│   │   ├── services/           # API clients (api.ts with axios + interceptors)
│   │   ├── store/              # State management (authStore.ts with Zustand)
│   │   ├── test/               # Test utilities and mocks
│   │   ├── App.tsx             # Router configuration
│   │   ├── main.tsx            # React entry point
│   │   └── index.css           # Tailwind CSS + custom styles
│   ├── vitest.config.ts        # Test configuration
│   ├── tailwind.config.js      # Tailwind CSS config
│   ├── package.json            # Node dependencies
│   └── tsconfig.json           # TypeScript config
│
├── customer-portal/            # Customer self-service portal (React)
│   ├── src/
│   │   ├── pages/              # Pages (Login, Signup, Dashboard, APIKeys)
│   │   ├── components/         # Layout and components
│   │   ├── services/           # API client
│   │   ├── store/              # State management
│   │   ├── App.tsx             # Router
│   │   └── main.tsx            # Entry point
│   └── package.json            # Dependencies
│
├── website/                    # Marketing website (static or CMS)
│   └── assets/                 # Images, logos, etc.
│
├── docs/                       # Documentation
│   └── assets/                 # Doc images
│
├── .planning/                  # GSD planning documents
│   └── codebase/               # Codebase analysis (this file)
│
├── .claude/                    # Claude-specific configuration
│   └── settings.local.json     # Local settings
│
├── docker-compose.yml          # Docker Compose for local dev (PostgreSQL, Redis, MinIO)
└── README.md                   # Project documentation
```

## Directory Purposes

**`backend/`:**
- Main regulatory reporting platform
- FastAPI-based REST API with 24 resource routers
- Celery task queue for async workflows
- SQLAlchemy ORM with PostgreSQL backend
- Multi-tenant support with RBAC

**`backend/api/`:**
- Contains: 24 router modules (auth, reports, connectors, mappings, validations, schedules, destinations, runs, logs, submissions, admin, schemas, dashboard, xbrl, delivery, streaming, lineage, api_keys, workflow, webhooks, external_api, queries, exceptions)
- Each module: FastAPI APIRouter with Pydantic request/response schemas
- Pattern: Route → Pydantic schema validation → Service layer call → Response

**`backend/services/`:**
- Core business logic: Auth, code generation, code execution, connectors, database access, delivery, encryption, lineage, audit
- Subdirectories: `connectors/` (5 DB engines), `artifacts/` (output generation), `external_api/` (regulatory data sync), `workflow/` (state machine)
- 36 Python modules total

**`backend/core/`:**
- `logging.py`: Structured logging setup (JSON in production)
- `security.py`: JWT token generation, password hashing, JTI generation
- `permissions.py`: RBAC decorator-based permission checking
- `tenancy.py`: Multi-tenant context isolation
- `exceptions.py`: Custom exception classes with error codes

**`backend/middleware/`:**
- `request_context.py`: Injects request_id, tenant_id, user info into context
- `rate_limit.py`: Redis-based rate limiting by IP

**`backend/tasks/`:**
- Celery shared tasks for async job execution
- `workflow_tasks.py`: Main report workflow orchestrator
- `step_tasks.py`: Individual step handlers (data fetch, validation, transform, etc.)
- `webhook_tasks.py`: Fire webhooks on workflow state changes
- `streaming_tasks.py`: Real-time data streaming
- `external_sync_tasks.py`: Sync regulatory reference data from external APIs

**`backend/tests/`:**
- Unit tests: Pydantic schemas, validators, auth logic
- Integration tests: API endpoints with test database, Celery tasks
- Config: `conftest.py` with pytest fixtures
- Markers: `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.slow`

**`backend/alembic/`:**
- Database migrations using Alembic
- `versions/`: Migration files (001_add_api_keys, 002_add_workflow_tables, etc.)
- Auto-generated from model changes: `alembic revision --autogenerate -m "description"`
- Applied at startup via `init_db.py`

**`external_api/`:**
- Separate FastAPI service (can run on different port/server)
- Read-only API for external customer access
- API key authentication (separate from main JWT auth)
- Customer account management, billing, API key rotation
- Shares backend database or has separate database copy

**`frontend/src/pages/`:**
- Page components (full screen views)
- Files: Reports, Connectors, Runs, Mappings, Validations, Exceptions, Schedules, Destinations, Streaming, Admin, Schemas, ExternalAPI, Dashboard, Login
- Pattern: React FC with hooks (useQuery, useState, useEffect), calls api.ts for data

**`frontend/src/components/`:**
- Reusable UI components
- Subdirectories: `api/` (ApiSnippetGenerator), `workflow/` (WorkflowProgress)
- Key: Layout.tsx (header, nav, footer), ReportWizard.tsx (multi-step form), LineageGraph.tsx (D3 DAG viz)

**`frontend/src/services/api.ts`:**
- Axios instance configured with:
  - Base URL: `${VITE_API_URL}/api/v1`
  - Request interceptor: Adds Authorization header, refreshes token if expired
  - Response interceptor: Handles 401 (logout), 403 (permission denied)
  - Token refresh queue: Handles concurrent requests during token refresh
- Exports: Individual API client objects (reportsAPI, connectorsAPI, etc.)

**`frontend/src/store/authStore.ts`:**
- Zustand store for authentication state
- Methods: login(), logout(), updateTokens()
- State: accessToken, refreshToken, user (id, email, permissions), isAuthenticated

**`customer-portal/`:**
- Standalone React app (separate port, separate server)
- Self-service for external customers
- Local authentication (not JWT from main backend)
- Manages API keys, views usage statistics, account settings

**`docs/`:**
- User documentation, API guides
- Markdown files with images in `assets/`

**`.planning/codebase/`:**
- GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md)

## Key File Locations

**Entry Points:**
- `backend/main.py`: FastAPI app bootstrap, middleware registration, router inclusion
- `backend/tasks/__init__.py`: Celery app initialization, task imports
- `backend/init_db.py`: Database schema creation, initial data seeding
- `external_api/main.py`: External API FastAPI app
- `frontend/src/main.tsx`: React root render
- `customer-portal/src/main.tsx`: Customer portal React root

**Configuration:**
- `backend/config.py`: Settings from env vars (database, redis, minio, jwt, encryption, etc.)
- `backend/.env`: Development environment variables (gitignored in production)
- `docker-compose.yml`: Docker services (PostgreSQL, Redis, MinIO for local dev)
- `frontend/.env.local`: Frontend env (API_URL)
- `backend/alembic/alembic.ini`: Alembic configuration (database URL template)

**Core Logic:**
- `backend/models.py`: All SQLAlchemy ORM models (20+ classes)
- `backend/services/workflow/state_machine.py`: Report execution state machine
- `backend/services/workflow/executor.py`: Workflow step executor with retry/timeout
- `backend/services/executor.py`: Sandboxed Python code execution
- `backend/services/connectors/factory.py`: Database connector factory (PostgreSQL, SQL Server, Oracle, MySQL, ODBC)
- `backend/services/code_generator.py`: Generate Python transformation code
- `backend/core/permissions.py`: RBAC permission checker

**Testing:**
- `backend/tests/conftest.py`: Pytest fixtures (test database, auth tokens, sample data)
- `backend/tests/test_auth_api.py`: Authentication endpoint tests
- `backend/tests/test_auth_service.py`: Auth service logic tests
- `backend/tests/test_validation_engine.py`: Validation rule evaluation
- `backend/tests/test_workflow_state_machine.py`: State transition logic
- `backend/tests/test_api_keys_service.py`: API key management
- `frontend/src/test/utils.tsx`: Test utilities (mock API, render helpers)
- `frontend/src/**/*.test.tsx`: Component tests (Login, Dashboard, etc.)

## Naming Conventions

**Files:**
- Python: snake_case.py (e.g., `api_keys.py`, `code_generator.py`)
- React/TypeScript: PascalCase.tsx for components (e.g., `Dashboard.tsx`, `ReportWizard.tsx`), camelCase.ts for utilities (e.g., `api.ts`, `authStore.ts`)
- Database migrations: `NNN_description.py` (e.g., `001_add_api_keys.py`, `005_add_customer_tables.py`)

**Directories:**
- Python: snake_case (e.g., `api/`, `services/`, `core/`)
- React: either PascalCase or snake_case for feature dirs (e.g., `components/`, `pages/`, `src/`)

**Classes:**
- Models: PascalCase (e.g., `User`, `Report`, `ReportVersion`, `Connector`)
- Enums: PascalCase (e.g., `ConnectorType`, `ReportVersionStatus`, `JobRunStatus`)
- Services: PascalCase ending in "Service" (e.g., `AuthService`, `CodeGenerator`)
- Routers: Lowercase (e.g., `auth`, `reports`, `connectors`)

**Functions:**
- Snake_case (e.g., `get_current_user()`, `check_database_connection()`)
- Async functions: Prefixed with `async` keyword

**API Endpoints:**
- REST conventions: `GET /api/v1/reports` (list), `POST /api/v1/reports` (create), `GET /api/v1/reports/{id}` (read), `PUT /api/v1/reports/{id}` (update), `DELETE /api/v1/reports/{id}` (delete)
- Actions: `POST /api/v1/reports/{id}/run` (trigger), `POST /api/v1/reports/{id}/versions` (create version)
- Query params: `?status=active&limit=50&offset=0`

**Database Table Names:**
- snake_case (e.g., `user`, `report`, `report_version`, `connector`, `validation_rule`)
- Plural for most tables (e.g., `reports`, `connectors`)

**Environment Variables:**
- UPPER_CASE (e.g., `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `LOG_LEVEL`)
- Grouped by feature: `MINIO_*`, `JWT_*`, `RATE_LIMIT_*`, `EXTERNAL_API_*`

## Where to Add New Code

**New REST API Endpoint:**
1. Create Pydantic schema in route file: `backend/api/new_feature.py`
2. Create APIRouter with decorated functions
3. If business logic needed, add to `backend/services/new_feature_service.py`
4. Register router in `backend/main.py`: `app.include_router(new_feature.router, prefix="/api/v1/new-feature", tags=["New Feature"])`
5. Add database model to `backend/models.py` if new entity
6. Test in `backend/tests/test_new_feature_api.py`

**New Async Task:**
1. Create task function in `backend/tasks/task_name_tasks.py`
2. Decorate with `@shared_task`
3. Import in task consumer/scheduler
4. Call from API: `task_name.delay(args)`
5. Test with Celery test runner

**New Service:**
1. Create `backend/services/feature_name.py`
2. Define class with public methods
3. Import in API routes as needed
4. Add unit tests in `backend/tests/test_feature_name_service.py`

**New Frontend Page:**
1. Create component: `frontend/src/pages/NewPage.tsx`
2. Import API client: `import { featureAPI } from '../services/api'`
3. Use React Query: `const { data, isLoading } = useQuery('feature', () => featureAPI.list())`
4. Add route in `frontend/src/App.tsx`: `<Route path="/new-page" element={<NewPage />} />`
5. Add nav link in `frontend/src/components/Layout.tsx`
6. Test in `frontend/src/pages/NewPage.test.tsx`

**New Frontend Component:**
1. Create: `frontend/src/components/FeatureName.tsx`
2. Accept props typed via TypeScript interface
3. Use hooks (useState, useEffect, useQuery as needed)
4. Style with Tailwind CSS classes
5. Export from component barrel file if creating subdirectory
6. Test in `frontend/src/components/FeatureName.test.tsx`

**New Database Model:**
1. Add class to `backend/models.py` inheriting from `Base`
2. Define columns with SQLAlchemy Column types
3. Define relationships with `relationship()` if foreign keys
4. Create migration: `alembic revision --autogenerate -m "Add new_table"`
5. Verify migration in `backend/alembic/versions/NNN_add_new_table.py`
6. Apply: Runs automatically at `main.py` startup

**New Validation Rule:**
1. Create in `backend/api/validations.py` or dedicated service
2. Define rule in database as `ValidationRule` model with:
   - `rule_type`: "sql" or "python_expr"
   - `expression`: SQL query or Python expression
   - `severity`: "warning", "blocking", or "correctable"
   - `execution_phase`: "pre_generation" or "pre_delivery"
3. Execute via `ValidationEngine` in workflow step

**New Database Migration:**
```bash
cd backend
alembic revision --autogenerate -m "Add new_table or modify existing_table"
# Edit generated file in alembic/versions/
alembic upgrade head  # Apply to local DB
```

## Special Directories

**`backend/alembic/`:**
- Purpose: Version control for database schema
- Generated: Migration files auto-generated by `alembic revision --autogenerate`
- Committed: Yes, all migration files tracked in git
- Pattern: Create model change → Run alembic → Commit migration → Apply in deployment

**`backend/scripts/`:**
- Purpose: Utility scripts for operations (data loading, checking configs, migrations)
- Not part of main app, run manually: `python backend/scripts/add_field_mappings.py`
- Files: `add_field_mappings.py`, `add_version_columns.py`, `check_job_errors.py`, `check_report_config.py`, `check_table_columns.py`

**`frontend/src/test/`:**
- Purpose: Test utilities and mock setup
- Files: `utils.tsx` (custom render with providers), `mocks/` (API mocks for Vitest)
- Used by: Component test files

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: By codebase mapper from `/gsd:map-codebase` command
- Committed: Yes
- Used by: Planner and executor for code generation guidance

**`.claude/`:**
- Purpose: Claude-specific local configuration
- Generated: By Claude during analysis/planning
- Committed: No (gitignored locally)
