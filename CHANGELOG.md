# Changelog

All notable changes to OpenReg are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation foundation (Phase 2 in progress)
  - CHANGELOG.md following Keep a Changelog format
  - Comprehensive troubleshooting guide

## [0.5.0] - 2026-01-29

### Added
- GitHub Actions CI workflow for automated testing
- Playwright E2E smoke tests for authentication and user journey
- Page Object Model pattern for maintainable E2E tests
- Backend unit tests (90 tests):
  - Delivery service tests with SFTP/FTP mocking
  - External API sync service tests
  - Code executor service tests with sandbox validation
  - Workflow state machine tests
  - API key service tests
  - Authentication service tests
- Frontend component tests (62 tests):
  - Reports page with CRUD operations
  - Runs page with filtering and status display
  - Layout component with navigation
  - Login page with authentication flow
  - API service with error handling
  - Auth store with token management

### Changed
- MSW handlers expanded for comprehensive mock coverage
- Test infrastructure configured for Windows compatibility

## [0.4.0] - 2026-01-07

### Added
- Observability and production hardening
- Structured logging with request tracing
- Rate limiting and request throttling
- Health check endpoints for all services
- Prometheus metrics endpoint

### Changed
- Improved error messages with correlation IDs

## [0.3.0] - 2026-01-07

### Added
- Webhook system for workflow state notifications
- Sandbox mode for safe Python code execution
- Tenant environment management
- API key management system with secure generation
- Production-ready security with RBAC
- Workflow state machine with validation

### Security
- Role-based access control (RBAC) with granular permissions
- API key authentication for external integrations

## [0.2.0] - 2026-01-08

### Added
- External regulatory API integration
- Sync for reports, validations, and reference data
- Customer portal with Stripe billing integration
- External API service on port 8001

### Fixed
- Circular import issues in backend services
- MiFIR demo setup script improvements

## [0.1.0] - 2025-12-29

### Added
- Core regulatory reporting workflow
- Multi-tenant isolation with automatic query filtering
- Role-based access control (RBAC) with granular permissions
- Source connectors:
  - PostgreSQL
  - SQL Server
  - Oracle
  - MySQL
- Report workflow state machine with transitions
- Pre-generation and pre-delivery validation rules
- Data lineage tracking with field-level granularity
- Artifact generation:
  - XBRL output
  - CSV output
  - Excel output
  - XML output
- SFTP and FTP delivery with retry logic
- Job scheduling with cron expressions
- React frontend with:
  - Report management UI
  - Runs monitoring
  - Admin panel
  - Dashboard
  - Exception queue
- FastAPI backend with 24 API routers
- Docker Compose development environment

## [0.0.1] - 2025-12-10

### Added
- Initial project setup
- Basic application structure
- Backend API foundation
- Frontend scaffolding
- Database models
- Encryption service for credentials
- MiFIR report template

---

[Unreleased]: https://github.com/openreg/openreg/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/openreg/openreg/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/openreg/openreg/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/openreg/openreg/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/openreg/openreg/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/openreg/openreg/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/openreg/openreg/releases/tag/v0.0.1
