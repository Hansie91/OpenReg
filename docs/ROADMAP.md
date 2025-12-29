# OpenRegReport Portal - Roadmap

## Current Status: MVP

The MVP provides the foundation infrastructure and demonstrates core concepts.

---

## 📦 MVP → v1 Migration (Completed Features)

### Infrastructure ✅
- Docker Compose orchestration
- PostgreSQL, Redis, MinIO setup
- FastAPI backend with hot reload
- React frontend with Vite
- Health checks and restart policies

### Backend ✅
- SQLAlchemy models for all entities
- JWT authentication with refresh tokens
- Password hashing (bcrypt)
- Credential encryption (Fernet)
- Basic CRUD APIs (auth, reports, connectors, runs)
- Audit logging service
- MinIO integration for artifact storage
- Celery worker setup

### Frontend ✅
- React Router with protected routes
- Zustand state management
- Tailwind CSS styling
- Login page with auth flow
- Dashboard with statistics
- Reports management UI
- Connectors page
- Runs history viewer
- Responsive design

---

## 🎯 v1 - Production-Ready Core (Priority)

### Critical Features

#### 1. Complete Report Execution Pipeline
- [x] **Database Connector Plugins**
  - [x] PostgreSQL connector (via psycopg2)
  - [x] SQL Server connector (via pyodbc)
  - [x] Oracle connector (via oracledb)
  - [x] MySQL connector (via PyMySQL)
  - [x] Generic ODBC connector
  - [x] Connection pooling
  - [x] Query timeout handling

- [x] **Python Code Execution**
  - [x] Safe execution environment (RestrictedPython)
  - [x] Pre-approved library allowlist (pandas, lxml, etc.)
  - [x] Resource limits (CPU, memory, timeout)
  - [ ] Dependency management per report
  - [x] Error handling and stack traces
  - [x] Data size limits for memory safety

- [x] **Validation Engine**
  - [x] SQL-based validation execution
  - [x] Python expression evaluator
  - [x] Blocking vs. warning severity
  - [x] Validation result storage
  - [ ] Validation failure notifications

- [x] **Artifact Generation**
  - [x] CSV output format
  - [x] XML output format
  - [x] JSON output format
  - [x] TXT output format
  - [x] Checksum validation (MD5, SHA256)
  - [x] Metadata tagging

#### 2. SFTP/FTP Delivery System
- [x] **Paramiko SFTP implementation**
  - [ ] Key-based authentication
  - [x] Password authentication
  - [ ] Connection pooling
  - [x] Directory creation
  - [x] File upload with retry
  - [x] Acknowledgment tracking

- [x] **FTP implementation**
  - [x] Passive/active mode support
  - [x] TLS/SSL (FTPS)
  - [x] Retry with exponential backoff
  - [x] Delivery confirmation

- [x] **Routing Rules**
  - [x] Multi-destination delivery
  - [x] Delivery attempt logging
  - [ ] Conditional routing (by report, status, size)

#### 3. Cross-Reference Mappings
- [x] **Full CRUD API**
  - [x] Mapping set management
  - [x] Entry creation/update/delete
  - [x] Bulk CSV import/export
  - [x] Effective date filtering

- [x] **Frontend UI**
  - [x] Mapping set list/create
  - [x] Entry grid with inline editing
  - [x] Date range picker for effective dates
  - [x] CSV upload/download
  - [x] Search and filter

- [x] **Runtime Application**
  - [x] Lookup service in worker
  - [ ] Cache for performance
  - [x] Fallback handling

#### 4. Scheduling & Triggers
- [x] **Cron Scheduler**
  - [x] Cron expression parser (croniter)
  - [x] Next run calculation
  - [x] Celery Beat integration
  - [x] Schedule activation/deactivation

- [x] **Calendar UI**
  - [x] Visual schedule builder
  - [x] Business day support
  - [x] Holiday/blackout date exclusions
  - [x] Timezone handling

- [ ] **Event Triggers**
  - [ ] File arrival watcher
  - [ ] Database watermark polling
  - [x] API webhook receiver (manual trigger)
  - [x] Manual trigger

#### 5. Enhanced UI Components
- [ ] **Python Code Editor**
  - [ ] Monaco Editor integration
  - [x] Syntax highlighting (basic)
  - [ ] Autocomplete for approved libraries
  - [ ] Linting and error checking
  - [x] Save drafts

- [x] **Run Details Page**
  - [x] Full execution timeline
  - [x] Log viewing (polling)
  - [x] Artifact download
  - [ ] Re-run button
  - [x] Error details

- [x] **Admin Panel**
  - [x] User management (CRUD)
  - [x] Role assignment
  - [x] Permission editor
  - [x] Audit log viewer (paginated, filterable)
  - [ ] System health metrics

#### 6. Production Hardening
- [ ] **Security**
  - [ ] HashiCorp Vault integration
  - [ ] TLS for all services
  - [ ] Rate limiting (SlowAPI)
  - [x] CORS lockdown
  - [ ] CSP headers

- [ ] **Deployment**
  - [x] Kubernetes manifests (documented)
  - [ ] Helm chart
  - [x] Health check probes
  - [x] Rolling updates (documented)
  - [x] Resource quotas

- [ ] **Monitoring**
  - [ ] Prometheus metrics exporter
  - [ ] Grafana dashboards
  - [ ] Alert rules (failed runs, disk space)
  - [ ] Distributed tracing (OpenTelemetry)

- [ ] **Backup & Recovery**
  - [x] PostgreSQL backup procedures (documented)
  - [x] MinIO backup procedures (documented)
  - [x] Disaster recovery procedures (documented)
  - [ ] Automated backups
  - [ ] Data retention policies

---

## 🚀 v2 - Enterprise Features (Future)

### Advanced Capabilities

#### 1. Multi-Tenancy
- [ ] Row-level security (PostgreSQL RLS)
- [ ] Tenant-specific buckets in MinIO
- [ ] Per-tenant quotas
- [ ] Cross-tenant report sharing (opt-in)

#### 2. Approval Workflows
- [ ] Draft → Review → Approved lifecycle
- [ ] Multi-stage approvals
- [ ] Reviewer assignment
- [ ] Email notifications
- [ ] Approval history

#### 3. Data Lineage
- [ ] Visual data flow diagrams
- [ ] Column-level lineage tracking
- [ ] Impact analysis ("what depends on this?")
- [ ] Data quality metrics

#### 4. Advanced RBAC
- [ ] Field-level permissions
- [ ] Dynamic roles (computed from attributes)
- [ ] Time-based access (temporary grants)
- [ ] Delegation

#### 5. External Authentication
- [ ] OIDC/OAuth2 integration
- [ ] SAML 2.0 support
- [ ] LDAP/Active Directory
- [ ] MFA (TOTP)

#### 6. Plugin Marketplace
- [ ] Plugin registry
- [ ] Community-contributed connectors
- [ ] Custom validation rule packs
- [ ] Delivery channel plugins (email, Slack, etc.)

#### 7. Performance Optimization
- [ ] Query result caching
- [ ] Report pre-computation
- [ ] Incremental data loads
- [ ] Partition pruning for large datasets

#### 8. Compliance & Governance
- [ ] Immutable audit log (blockchain or append-only storage)
- [ ] Data masking/anonymization
- [ ] Regulatory preset templates (MiFIR, EMIR, etc.)
- [ ] Compliance dashboard

#### 9. Advanced Reporting
- [ ] Report chaining (output of A → input to B)
- [ ] Conditional execution (run B only if A succeeds)
- [ ] Parallel execution of independent reports
- [ ] Report templates library

---

## 📊 Feature Prioritization

### High Priority (v1)
1. Report execution pipeline
2. SFTP/FTP delivery
3. Cross-reference mappings
4. Scheduling
5. Log streaming

### Medium Priority (v1)
1. Monaco editor
2. Admin panel
3. Kubernetes deployment
4. Monitoring

### Low Priority (v2)
1. Approval workflows
2. Data lineage
3. Plugin marketplace
4. External auth

---

## 🗓️ Estimated Timeline

| Milestone | Duration | Cumulative |
|-----------|----------|------------|
| MVP | Complete | - |
| v1 Core Features | 8-12 weeks | 3 months |
| v1 Production Hardening | 4-6 weeks | 4.5 months |
| v1 Release | - | 5 months |
| v2 Planning | 2 weeks | 5.5 months |
| v2 Implementation | 12-16 weeks | 9 months |
| v2 Release | - | 10 months |

---

## 🤝 Community Input

Feature requests and design feedback are welcome! Please:
- Open an issue for feature requests
- Use discussions for design proposals
- Vote on existing issues to prioritize

---

**Last Updated**: 2025-12-29
