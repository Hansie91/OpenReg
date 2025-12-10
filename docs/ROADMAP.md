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
- [ ] **Database Connector Plugins**
  - [ ] PostgreSQL connector (via psycopg2)
  - [ ] SQL Server connector (via pyodbc)
  - [ ] Oracle connector (via cx_Oracle)
  - [ ] MySQL connector (via PyMySQL)
  - [ ] Generic ODBC connector
  - [ ] Connection pooling
  - [ ] Query timeout handling

- [ ] **Python Code Execution**
  - [ ] Safe execution environment (Docker isolation)
  - [ ] Pre-approved library allowlist (pandas, lxml, etc.)
  - [ ] Resource limits (CPU, memory, timeout)
  - [ ] Dependency management per report
  - [ ] Error handling and stack traces
  - [ ] Data size limits for memory safety

- [ ] **Validation Engine**
  - [ ] SQL-based validation execution
  - [ ] Python expression evaluator
  - [ ] Blocking vs. warning severity
  - [ ] Validation result storage
  - [ ] Validation failure notifications

- [ ] **Artifact Generation**
  - [ ] CSV output format
  - [ ] XML output format
  - [ ] JSON output format
  - [ ] Checksum validation
  - [ ] Metadata tagging

#### 2. SFTP/FTP Delivery System
- [ ] **Paramiko SFTP implementation**
  - [ ] Key-based authentication
  - [ ] Password authentication
  - [ ] Connection pooling
  - [ ] Directory creation
  - [ ] File upload with retry
  - [ ] Acknowledgment tracking

- [ ] **FTP implementation**
  - [ ] Passive/active mode support
  - [ ] TLS/SSL (FTPS)
  - [ ] Retry with exponential backoff
  - [ ] Delivery confirmation

- [ ] **Routing Rules**
  - [ ] Conditional routing (by report, status, size)
  - [ ] Multi-destination delivery
  - [ ] Delivery attempt logging

#### 3. Cross-Reference Mappings
- [ ] **Full CRUD API**
  - [ ] Mapping set management
  - [ ] Entry creation/update/delete
  - [ ] Bulk CSV import/export
  - [ ] Effective date filtering

- [ ] **Frontend UI**
  - [ ] Mapping set list/create
  - [ ] Entry grid with inline editing
  - [ ] Date range picker for effective dates
  - [ ] CSV upload/download
  - [ ] Search and filter

- [ ] **Runtime Application**
  - [ ] Lookup service in worker
  - [ ] Cache for performance
  - [ ] Fallback handling

#### 4. Scheduling & Triggers
- [ ] **Cron Scheduler**
  - [ ] Cron expression parser (croniter)
  - [ ] Next run calculation
  - [ ] Celery Beat integration
  - [ ] Schedule activation/deactivation

- [ ] **Calendar UI**
  - [ ] Visual schedule builder
  - [ ] Business day support
  - [ ] Holiday calendar integration
  - [ ] Timezone handling

- [ ] **Event Triggers**
  - [ ] File arrival watcher
  - [ ] Database watermark polling
  - [ ] API webhook receiver
  - [ ] Manual trigger

#### 5. Enhanced UI Components
- [ ] **Python Code Editor**
  - [ ] Monaco Editor integration
  - [ ] Syntax highlighting
  - [ ] Autocomplete for approved libraries
  - [ ] Linting and error checking
  - [ ] Save drafts

- [ ] **Run Details Page**
  - [ ] Full execution timeline
  - [ ] Log streaming (WebSocket or polling)
  - [ ] Artifact download
  - [ ] Re-run button
  - [ ] Error details

- [ ] **Admin Panel**
  - [ ] User management (CRUD)
  - [ ] Role assignment
  - [ ] Permission editor
  - [ ] Audit log viewer (paginated, filterable)
  - [ ] System health metrics

#### 6. Production Hardening
- [ ] **Security**
  - [ ] HashiCorp Vault integration
  - [ ] TLS for all services
  - [ ] Rate limiting (SlowAPI)
  - [ ] CORS lockdown
  - [ ] CSP headers

- [ ] **Deployment**
  - [ ] Kubernetes manifests
  - [ ] Helm chart
  - [ ] Health check probes
  - [ ] Rolling updates
  - [ ] Resource quotas

- [ ] **Monitoring**
  - [ ] Prometheus metrics exporter
  - [ ] Grafana dashboards
  - [ ] Alert rules (failed runs, disk space)
  - [ ] Distributed tracing (OpenTelemetry)

- [ ] **Backup & Recovery**
  - [ ] PostgreSQL automated backups
  - [ ] MinIO bucket replication
  - [ ] Disaster recovery procedures
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

**Last Updated**: 2025-12-07
