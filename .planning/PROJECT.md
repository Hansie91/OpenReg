# OpenReg

## What This Is

OpenReg is an open source regulatory reporting portal for financial institutions. It enables firms of any size to connect to their source systems, map data to regulatory formats (MiFIR, EMIR, SFTR), validate transactions, and deliver reports to regulators — all without vendor lock-in. Works standalone with manual configuration, or with an API subscription for automated reference data, validation rules, and schema updates.

## Core Value

Simple on-prem installation that just works — if a compliance team can't get it running in an afternoon, we've failed.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ User authentication with JWT, refresh tokens, and session management — existing
- ✓ Role-based access control (RBAC) with granular permissions — existing
- ✓ Multi-tenant isolation with automatic query filtering — existing
- ✓ Source connectors for PostgreSQL, SQL Server, Oracle, MySQL — existing
- ✓ Report workflow state machine (pending → completed with intermediate states) — existing
- ✓ Sandboxed Python code execution for data transformations — existing
- ✓ Pre-generation and pre-delivery validation with severity levels — existing
- ✓ Data lineage tracking from source to output — existing
- ✓ Artifact generation (XBRL, CSV, Excel) — existing
- ✓ Delivery via SFTP and FTP — existing
- ✓ External API sync for regulatory reference data — existing
- ✓ Customer portal with API key management and Stripe billing — existing
- ✓ Job scheduling with cron expressions — existing
- ✓ Webhook notifications on workflow state changes — existing
- ✓ Rate limiting and request throttling — existing
- ✓ Structured logging with request tracing — existing

### Active

<!-- Current scope. Building toward v1.0 production-ready release. -->

**Documentation:**
- [ ] Installation guide (Docker, on-prem, cloud)
- [ ] API documentation (OpenAPI/Swagger with examples)
- [ ] User guide for report configuration workflow
- [ ] Administrator guide for connector and destination setup
- [ ] Developer guide for extending with custom connectors

**Testing:**
- [ ] Backend unit test coverage for critical services
- [ ] Frontend component test coverage
- [ ] End-to-end test suite for core workflows
- [ ] Integration tests for external API sync

**Polish:**
- [ ] Consistent error handling across all API endpoints
- [ ] User-friendly error messages in frontend
- [ ] Loading states and feedback throughout UI
- [ ] Edge case handling in workflow execution
- [ ] Mobile-responsive improvements to admin UI

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Snowflake/Redshift connectors — v1.1 (core SQL databases sufficient for launch)
- Kafka streaming connector — v1.1 (batch processing covers v1 use cases)
- SCP delivery — v1.1 (SFTP covers most regulatory endpoints)
- Email delivery — v1.1 (SFTP/FTP primary for regulatory submission)
- Regulator response handling — v1.1 (manual tracking acceptable for v1)
- Event-based scheduling (db completeness) — v1.1 (cron scheduling sufficient for launch)
- OAuth/SSO login — v1.1 (email/password sufficient for v1)
- Mobile app — web-first, mobile later
- Real-time streaming reports — batch model for v1

## Context

**Existing Codebase:**
- FastAPI backend with 24 API router modules
- React/TypeScript frontend with Vite build
- Celery task queue with Redis broker
- PostgreSQL database with Alembic migrations
- MinIO for artifact storage
- Separate external API service for customer integrations

**Target Market:**
- Financial institutions of all sizes (small firms to large banks)
- Compliance and operations teams
- EU regulatory regimes: MiFIR/MiFID II, EMIR, SFTR initially

**Competitive Landscape:**
- Existing solutions are expensive, complex, and have poor UX
- No viable open source alternative exists
- Opportunity to become the go-to option for firms wanting control

**Business Model:**
- Portal is free/open source (MIT or similar)
- API subscription provides: reference data (LEIs, ISINs, MICs), validation rules, format/schema updates, database DDLs
- Without subscription: fully functional with manual configuration

**Success Metric:**
- Adoption — firms actively using it, GitHub stars, community engagement

## Constraints

- **Deployment**: Must run in Docker containers (on-prem or any cloud)
- **Dependencies**: Minimize external service requirements for standalone mode
- **Licensing**: Open source friendly (no GPL-incompatible dependencies)
- **Performance**: Handle typical firm volumes (10K-100K transactions/day) without tuning

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI + React stack | Modern, async-first, good DX, strong ecosystem | ✓ Good |
| Celery for async tasks | Mature, battle-tested, Redis as broker already needed | ✓ Good |
| Multi-tenant from start | Enables SaaS model, customer isolation | ✓ Good |
| Sandboxed Python for transforms | Flexibility for complex mappings, security via RestrictedPython | — Pending |
| SFTP/FTP first for delivery | Covers most regulatory endpoints | — Pending |
| Stripe for billing | Standard, well-documented, handles EU requirements | — Pending |

---
*Last updated: 2026-01-29 after initialization*
