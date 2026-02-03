<p align="center">
  <img src="docs/assets/openreg-logo.jpg" alt="OpenReg" width="600">
</p>

<h1 align="center">OpenReg</h1>

<p align="center">
  <strong>Enterprise-Grade Regulatory Reporting Platform</strong>
</p>

<p align="center">
  <em>Automate, validate, and deliver regulatory reports with confidence</em>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache-2.0"></a>
  <a href="https://github.com/Hansie91/OpenReg"><img src="https://img.shields.io/badge/GitHub-OpenReg-181717?logo=github" alt="GitHub"></a>
  <a href="https://github.com/Hansie91/OpenReg/releases"><img src="https://img.shields.io/github/v/release/Hansie91/OpenReg?include_prereleases&label=Release" alt="Release"></a>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 15">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker Ready">
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-platform-screenshots">Screenshots</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-supported-regulations">Regulations</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-api-documentation">API</a>
</p>

---

## Overview

**OpenReg** is a self-hosted, open-source regulatory reporting platform designed for financial institutions, asset managers, trading firms, and compliance teams. It provides end-to-end automation for generating, validating, and delivering regulatory reports across multiple jurisdictions including **EMIR**, **MiFIR**, **SFTR**, and more.

Built for production environments, OpenReg offers a modern web interface, robust security controls, a Common Data Model (CDM) for data normalization, configurable Data Quality Indicators (DQIs), and the flexibility to handle complex reporting requirements—from simple data transformations to sophisticated multi-source aggregations.

### Why OpenReg?

| Challenge | OpenReg Solution |
|-----------|------------------|
| Manual report generation is error-prone | Automated, repeatable workflows with version control |
| Regulatory changes require code deployments | No-code configuration with packaged regulation templates |
| Multiple data sources and formats | Common Data Model (CDM) with universal database connectivity |
| Complex data quality requirements | Configurable DQIs with threshold-based alerting |
| Compliance audit requirements | Full audit trail with user attribution and version history |
| Complex validation requirements | Rule engine with blocking/warning validations and exception management |
| Delivery to regulators/trade repositories | Automated SFTP/FTP/Email delivery with retry and acknowledgment tracking |
| Scheduling complexity | Advanced calendar-based scheduling with holiday calendars and blackout dates |
| Partner integration needs | Full-featured REST API with webhooks and real-time status |

---

## 📸 Platform Screenshots

### Dashboard
Real-time overview of reporting operations with daily summaries, recent runs, and system health metrics.

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="100%">
</p>

### Report Management
Configure and manage regulatory reports with visual field mapping and XSD schema support.

<p align="center">
  <img src="docs/screenshots/reports.png" alt="Reports" width="100%">
</p>

### Common Data Model (CDM)
Explore the canonical data model with field-level lineage tracing from source systems to regulatory outputs.

<p align="center">
  <img src="docs/screenshots/cdm.png" alt="Common Data Model" width="100%">
</p>

### Data Quality Analysis
Monitor data quality trends with configurable indicators, validation pass rates, and exception tracking.

<p align="center">
  <img src="docs/screenshots/data-quality.png" alt="Data Quality" width="100%">
</p>

### Advanced Scheduling
Configure complex schedules with calendar-based frequency, multiple time slots, holiday calendars, and blackout dates.

<p align="center">
  <img src="docs/screenshots/schedules.png" alt="Schedules" width="100%">
</p>

### Execution Monitoring
Track job runs in real-time with workflow state visualization and detailed logging.

<p align="center">
  <img src="docs/screenshots/runs.png" alt="Run Monitoring" width="100%">
</p>

### Exception Management
Review, amend, and resubmit failed validation records with full audit trail.

<p align="center">
  <img src="docs/screenshots/exceptions.png" alt="Exception Queue" width="100%">
</p>

---

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended for production)
- Available ports: 3000, 8000, 5432, 6379, 9000

### Installation

```bash
# Clone the repository
git clone https://github.com/Hansie91/OpenReg.git
cd OpenReg

# Configure environment (optional - defaults work for development)
cp .env.example .env

# Start all services
docker-compose up -d

# Initialize the database (first run only)
docker-compose exec backend python init_db.py
```

### Access the Platform

| Service | URL | Description |
|---------|-----|-------------|
| **Web Portal** | http://localhost:3000 | Main application interface |
| **API Documentation** | http://localhost:8000/docs | Interactive OpenAPI docs |
| **Storage Console** | http://localhost:9001 | MinIO object storage UI |

**Default Credentials:**
- Portal: `admin@example.com` / `admin123`
- MinIO: `minioadmin` / `minioadmin`

> ⚠️ **Security Notice:** Change all default credentials before deploying to production. See the [Security Guide](docs/SECURITY.md) for hardening recommendations.

---

## ✨ Key Features

### Common Data Model (CDM) — Based on ISDA CDM

OpenReg includes a **Common Data Model** inspired by the [ISDA Common Domain Model (CDM)](https://www.isda.org/2019/10/14/isda-common-domain-model/), the industry standard for representing financial products, trades, and lifecycle events. Our CDM normalizes data from multiple source systems into a canonical format optimized for regulatory reporting.

<table>
<tr>
<td width="50%">

**ISDA CDM Alignment**
- Trade and transaction representations following ISDA standards
- Product taxonomy for derivatives and securities
- Lifecycle event modeling (NEWT, MODI, CANC, TERM)
- Party and counterparty identification (LEI-based)
- Collateral and margin representations

</td>
<td width="50%">

**OpenReg Extensions**
- Multi-regulation field mapping layer
- Source system connectors with ETL pipelines
- Historical versioning and audit trail
- Real-time data quality monitoring
- Field-level lineage tracking

</td>
</tr>
</table>

**Why ISDA CDM?**

The ISDA CDM provides a standardized, machine-readable blueprint for financial markets data. By aligning with this industry standard:

- ✅ **Interoperability** — Easier integration with counterparties and market infrastructure
- ✅ **Regulatory Alignment** — ESMA, FCA, and CFTC increasingly reference CDM concepts
- ✅ **Future-Proof** — Built on the same foundations as DLT and smart contract initiatives
- ✅ **Reduced Reconciliation** — Common language reduces breaks in trade matching

<table>
<tr>
<td width="50%">

**Data Normalization**
- Canonical schema for trades, positions, valuations
- Automatic field mapping from source systems
- Support for multiple source connectors per entity
- Historical data versioning

</td>
<td width="50%">

**Field-Level Lineage**
- Trace any output field to its source
- Visual lineage explorer in the UI
- Impact analysis for schema changes
- Audit-ready documentation

</td>
</tr>
</table>

### Data Quality Indicators (DQI)

Configurable quality metrics aligned with regulatory expectations:

| Indicator | Description |
|-----------|-------------|
| **Trade Pairing Mismatch Rate** | Percentage of paired trades with field mismatches |
| **Position Mismatch Rate** | Percentage of positions with reconciliation differences |
| **Missing Valuation Rate** | Open trades without required valuations |
| **UTI Pairing Failure Rate** | Trades that failed UTI pairing at the trade repository |
| **TR Rejection Rate** | Percentage of submissions rejected by the trade repository |

- Configurable warning and critical thresholds
- Trend analysis over time
- Per-report DQI assignment
- Packaged DQIs for each regulation

### Report Management

<table>
<tr>
<td width="50%">

**Declarative Configuration**
- Visual field mapping between source data and output schema
- XSD schema upload with automatic element parsing
- Support for XML, JSON, CSV, and fixed-width formats
- Configurable file naming with dynamic tokens
- Packaged templates for major regulations

</td>
<td width="50%">

**Advanced Transformations**
- Python code editor with syntax highlighting
- Sandboxed execution with whitelisted libraries
- DataFrame-based data manipulation
- Cross-reference mapping lookups
- CDM query integration

</td>
</tr>
</table>

### Workflow Engine

OpenReg features a state machine-based workflow engine for reliable report execution:

```
PENDING → INITIALIZING → FETCHING_DATA → PRE_VALIDATION → TRANSFORMING → POST_VALIDATION → GENERATING_ARTIFACTS → DELIVERING → COMPLETED
```

- **Real-time Progress** — Track execution progress (0-100%) with step-by-step updates
- **Automatic Retry** — Configurable retry policies with exponential/linear backoff
- **Cancellation Support** — Cancel running workflows gracefully
- **Execution History** — Full state transition audit trail

### Advanced Scheduling

<table>
<tr>
<td width="50%">

**Calendar-Based Scheduling**
- Daily, weekly, monthly, yearly frequencies
- Multiple time slots per day
- Specific weekday selection
- Month-end reporting support

</td>
<td width="50%">

**Business Day Intelligence**
- Holiday calendar management
- Import standard calendars (TARGET2, US Federal, UK Bank)
- Blackout date configuration
- T+0, T+1, T+2 business date offsets

</td>
</tr>
</table>

- **Schedule Dependencies** — Chain reports that must run in sequence
- **Preview Mode** — See upcoming run times before saving
- **Manual Trigger** — Execute schedules on-demand

### Validation Engine

- **Pre-generation validation** — Validate source data before processing
- **Post-generation validation** — Verify output compliance
- **Exception queue** — Review, correct, and resubmit failed records
- **Validation severity levels** — Blocking, warning, and correctable rules
- **Bulk amendment** — Correct multiple records efficiently

### Delivery & Acknowledgment

| Protocol | Features |
|----------|----------|
| **SFTP** | SSH key and password authentication, configurable paths |
| **FTP** | Secure FTP with TLS support |
| **Email** | SMTP delivery with attachments |

- Automatic retry with configurable backoff
- Delivery acknowledgment tracking
- File naming templates with tokens
- Delivery status webhooks

### Partner API & Webhooks

<table>
<tr>
<td width="50%">

**REST API**
- Full-featured API for all operations
- API key authentication with scoped permissions
- Rate limiting (configurable per key tier)
- OpenAPI 3.0 documentation

</td>
<td width="50%">

**Webhooks**
- Real-time event notifications
- HMAC-SHA256 signed payloads
- Configurable retry with backoff
- Events: `job.started`, `job.completed`, `job.failed`, `artifact.created`, `validation.failed`

</td>
</tr>
</table>

### Data Connectivity

| Database | Status | Notes |
|----------|--------|-------|
| PostgreSQL | ✅ Supported | Primary external database support |
| SQL Server | ✅ Supported | Windows Authentication and SQL Auth |
| Oracle | ✅ Supported | TNS and Easy Connect |
| MySQL | ✅ Supported | SSL/TLS connections |
| ODBC | ✅ Supported | Generic ODBC driver support |

### Security & Compliance

| Feature | Description |
|---------|-------------|
| **JWT Authentication** | Access + refresh tokens with configurable expiry, issuer/audience claims |
| **API Key Auth** | Alternative authentication for M2M integrations |
| **Token Revocation** | Server-side logout with Redis-backed token store |
| **Role-Based Access** | 50+ granular permissions with wildcard support |
| **Multi-Tenant** | Row-level tenant isolation with automatic filtering |
| **Credential Encryption** | AES-256 (Fernet) encryption for all stored secrets |
| **Audit Logging** | Comprehensive trail with 25+ event types |
| **Rate Limiting** | Redis-backed rate limiting with tier-based limits |
| **Query Safety** | Timeout enforcement, row limits, SQL injection detection |

---

## 🌍 Supported Regulations

OpenReg provides **production-ready report templates** with pre-configured field mappings, comprehensive validation rules, and ISO 20022 XML schemas for major regulatory regimes.

### Packaged Report Templates

#### MiFIR RTS 25 — Transaction Reporting

| | |
|---|---|
| **Template ID** | `mifir-rts25-v1` |
| **Message Type** | `auth.016.001.01` (FinInstrmRptgTxRpt) |
| **Namespace** | `urn:iso:std:iso:20022:tech:xsd:auth.016.001.01` |
| **Fields** | 65 mapped fields covering complete RTS 25 specification |
| **Validations** | 35 rules including LEI checksum, ISIN validation, MIC codes |

**Coverage:** Transaction reference, executing entity, buyer/seller details, instrument identification (ISIN/CFI), trading venue (MIC), price/quantity, trading capacity, waiver indicators, short selling flags.

<details>
<summary>View validation rules</summary>

- LEI format and checksum validation (ISO 17442)
- ISIN format and checksum validation (ISO 6166)
- MIC code validation (ISO 10383)
- Currency code validation (ISO 4217)
- Country code validation (ISO 3166-1)
- CFI code format validation (ISO 10962)
- Trading capacity values (DEAL, MTCH, AOTC)
- Report status values (NEWT, CANC, AMND)
- Buyer/seller differentiation check
- T+1 reporting deadline warnings
- Price and quantity range checks

</details>

---

#### EMIR REFIT — Derivative Trade Reporting

| | |
|---|---|
| **Template ID** | `emir-refit-v1` |
| **Message Type** | `auth.030.001.03` (DerivsTradRpt) |
| **Namespace** | `urn:iso:std:iso:20022:tech:xsd:auth.030.001.03` |
| **Fields** | Full EMIR REFIT field coverage for OTC and ETD |
| **Validations** | 42 rules covering counterparty, UTI, dates, amounts |

**Coverage:** UTI (ISO 23897), counterparty LEIs, trade/effective/maturity dates, notional amounts, asset class, contract type, clearing status, collateralization, valuation, margins.

<details>
<summary>View validation rules</summary>

- UTI format validation (1-52 alphanumeric, LEI prefix)
- Counterparty LEI format and checksum
- Counterparties must be different entities
- Date sequence validation (trade ≤ effective ≤ maturity)
- Asset class values (INTR, CRDT, EQUI, COMM, CURR)
- Contract type values (SWAP, FRAS, FUTR, OPTN, etc.)
- Action type values (NEWT, MODI, CORR, TERM, EROR, etc.)
- CCP LEI required when cleared = Y
- Prior UTI required for lifecycle events
- Financial counterparty sector codes
- Collateralization type validation
- T+1 reporting deadline warnings

</details>

---

#### SFTR — Securities Financing Transaction Reporting

| | |
|---|---|
| **Template ID** | `sftr-standard-v1` |
| **Message Type** | `auth.052.001.01` (SctiesFincgRptgTxRpt) |
| **Namespace** | `urn:iso:std:iso:20022:tech:xsd:auth.052.001.01` |
| **Fields** | Complete SFTR field set for repos, securities lending, margin lending |
| **Validations** | 50 rules covering SFT-specific requirements |

**Coverage:** UTI, counterparty LEIs, SFT type (REPO, SLEB, BSBC, MGLD), execution/value/maturity dates, collateral ISIN, principal amount, repo rate, lending fees, haircuts, margins.

<details>
<summary>View validation rules</summary>

- UTI format validation (ISO 23897)
- Counterparty LEI validation
- SFT type values (REPO, SLEB, BSBC, MGLD)
- Collateral ISIN format and checksum
- Date sequence validation
- Action type values (NEWT, MODI, VALU, COLU, ETRM, etc.)
- CCP LEI required when cleared
- Prior UTI required for lifecycle events
- Repo rate required for REPO type
- Lending fee/rebate required for SLEB type
- Security ISIN required for securities lending
- Haircut percentage range (0-100%)
- Tri-party agent LEI for tri-party transactions
- Floating rate reference codes (ESTR, SONIA, SOFR, etc.)
- T+1 reporting deadline warnings

</details>

---

### Regulation Summary

#### European Union

| Regulation | Template | Message Type | Fields | Validations |
|------------|----------|--------------|--------|-------------|
| **MiFIR RTS 25** | `mifir-rts25-v1` | auth.016 | 65 | 35 |
| **EMIR REFIT** | `emir-refit-v1` | auth.030 | 50+ | 42 |
| **SFTR** | `sftr-standard-v1` | auth.052 | 40+ | 50 |

#### United Kingdom

UK variants use the same templates with jurisdiction-specific configuration:

| Regulation | Base Template | Competent Authority |
|------------|---------------|---------------------|
| **UK MiFIR** | `mifir-rts25-v1` | FCA |
| **UK EMIR** | `emir-refit-v1` | FCA/BoE |
| **UK SFTR** | `sftr-standard-v1` | FCA |

### Planned Support

| Regulation | Jurisdiction | Timeline | Notes |
|------------|--------------|----------|-------|
| **CFTC Rewrite** | United States | Q2 2026 | Swap data reporting |
| **SEC CAT** | United States | Q3 2026 | Consolidated audit trail |
| **MAS Reporting** | Singapore | Q4 2026 | OTC derivatives |
| **ASIC Reporting** | Australia | 2027 | Derivative transaction reporting |

### What's Included in Each Template

Every packaged report template includes:

| Component | Description |
|-----------|-------------|
| **Field Mappings** | Complete mapping from CDM fields to XML elements with XPath |
| **Transformations** | Data type conversions (dates, decimals, booleans, uppercase) |
| **Validation Rules** | Blocking, warning, and correctable validations |
| **XML Configuration** | ISO 20022 namespace, message type, header structure |
| **Default Values** | Sensible defaults for optional fields |
| **Documentation** | Field-level documentation referencing regulatory specs |
| **Sample Data** | Test datasets for validation and UAT |
| **DQI Package** | Pre-configured Data Quality Indicators |

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    React Web Application                     │  │
│  │              (TypeScript, Vite, TailwindCSS)                │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS / REST API
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                         API LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Backend                          │  │
│  │         (Python 3.11, SQLAlchemy, Pydantic)                │  │
│  │                                                             │  │
│  │  Middleware: Request Tracking • Rate Limiting • CORS       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   PostgreSQL    │   │      Redis      │   │      MinIO      │
│   (Metadata +   │   │   (Job Queue)   │   │   (Artifacts)   │
│      CDM)       │   │                 │   │                 │
│                 │   │  • Task Queue   │   │  • Report Files │
│  • Reports      │   │  • Rate Limits  │   │  • Audit Logs   │
│  • CDM Tables   │   │  • Token Store  │   │  • Backups      │
│  • Audit Logs   │   │  • Caching      │   │                 │
└─────────────────┘   └────────┬────────┘   └─────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                      WORKER LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   Celery Workers                            │  │
│  │        (Workflow Engine, Delivery, Webhooks)               │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │
│  │  │  Workflow   │  │  Validator  │  │  Delivery   │         │  │
│  │  │  Executor   │  │  Engine     │  │  Service    │         │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                   EXTERNAL CONNECTIONS                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Source    │  │    Trade    │  │   SFTP/FTP  │               │
│  │  Databases  │  │ Repositories│  │   Servers   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
└───────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS | Modern SPA with type safety |
| **Backend** | FastAPI, Python 3.11+ | High-performance async API |
| **Database** | PostgreSQL 15 | Metadata, CDM, configuration, audit logs |
| **Queue** | Celery + Redis | Distributed task execution |
| **Storage** | MinIO (S3-compatible) | Report artifacts and files |
| **Scheduling** | Celery Beat | Cron and calendar-based scheduling |
| **Execution** | RestrictedPython | Secure sandboxed code execution |
| **Logging** | structlog | Structured JSON logging |

---

## 📡 API Documentation

OpenReg provides a comprehensive REST API for all operations. See the [complete API Guide](docs/API_GUIDE.md) for full documentation with examples.

### Quick Authentication

```bash
# 1. Login and get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}' \
  | jq -r '.access_token')

# 2. Use token in requests
curl http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer $TOKEN"

# Alternative: API Key Authentication (for programmatic access)
curl http://localhost:8000/api/v1/reports \
  -H "X-API-Key: ork_your_api_key_here"
```

### API Endpoints

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | `/auth/login`, `/auth/refresh`, `/auth/logout` | JWT tokens and sessions |
| **Reports** | `/reports`, `/reports/{id}/execute` | Create, configure, execute reports |
| **Runs** | `/runs`, `/runs/{id}/artifacts` | View execution history, download files |
| **Connectors** | `/connectors`, `/connectors/{id}/test` | Database connections |
| **Destinations** | `/destinations` | SFTP/FTP/Email delivery endpoints |
| **Schedules** | `/schedules`, `/schedules/preview` | Cron and calendar scheduling |
| **Holiday Calendars** | `/holiday-calendars` | Business day calendar management |
| **Validations** | `/validations` | Data quality rules |
| **Exceptions** | `/exceptions` | Validation exception management |
| **CDM** | `/cdm/catalog`, `/cdm/lineage` | Common Data Model exploration |
| **Data Quality** | `/data-quality`, `/dqi` | Quality metrics and indicators |
| **Workflow** | `/workflow/runs/{id}/workflow` | Real-time execution status |
| **Webhooks** | `/webhooks` | Event notifications |
| **API Keys** | `/api-keys` | Programmatic access management |
| **Admin** | `/admin/users`, `/admin/roles` | User and role management |
| **Dashboard** | `/dashboard/daily-summary` | Summary statistics |

### Interactive Documentation

| Tool | URL | Description |
|------|-----|-------------|
| Swagger UI | http://localhost:8000/docs | Try API calls interactively |
| ReDoc | http://localhost:8000/redoc | Browsable documentation |
| OpenAPI JSON | http://localhost:8000/api/v1/openapi.json | Machine-readable spec |

---

## 📋 Roadmap

### ✅ v0.1 — Foundation (Completed)
- Web portal with authentication and RBAC
- Report management with semantic versioning
- Database connector configuration
- Report execution pipeline
- Multi-format output (XML, JSON, CSV, TXT)
- Validation engine with exception queue

### ✅ v0.2 — Automation & Security (Completed)
- Enhanced JWT with issuer/audience claims
- Token revocation with Redis-backed store
- API key authentication for partners
- Granular permission system (50+ permissions)
- Workflow state machine with progress tracking
- Real-time execution status API
- SFTP/FTP delivery with retry policies

### ✅ v0.3 — Partner API & Observability (Completed)
- Webhook system with HMAC-SHA256 signing
- Sandbox mode for safe testing
- Tenant environment management
- Structured logging (structlog)
- Request ID tracking and correlation
- Rate limiting with Redis backend
- Comprehensive audit event system
- Query safety (timeouts, row limits, injection detection)

### ✅ v0.4 — Data Quality & CDM (Completed)
- Common Data Model (CDM) with canonical schemas
- Field-level lineage tracking
- Data Quality Indicators (DQIs) framework
- Packaged regulation templates (EMIR, MiFIR, SFTR)
- Advanced calendar-based scheduling
- Holiday calendar management
- Schedule dependencies
- Email delivery protocol

### 📋 v1.0 — Enterprise (In Development)
- Approval workflows for report changes
- External authentication (OIDC/SAML)
- Kubernetes/Helm deployment charts
- Prometheus metrics and Grafana dashboards
- OpenTelemetry distributed tracing
- Advanced data lineage visualization
- Report comparison and diff tools

---

## 🛠️ Development

### Local Development Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend && pytest --cov=. --cov-report=html

# Frontend tests
cd frontend && npm test

# End-to-end tests
cd e2e && npx playwright test
```

### Code Quality

```bash
# Backend linting
cd backend && ruff check . && mypy .

# Frontend linting
cd frontend && npm run lint
```

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/improvement`)
3. **Commit** your changes with clear messages
4. **Test** thoroughly before submitting
5. **Open** a Pull Request with a detailed description

### Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

---

## 📄 License

OpenReg is licensed under the **Apache License 2.0**.

This license was chosen because it:
- ✅ Permits commercial use, modification, and distribution
- ✅ Includes explicit patent grant protection
- ✅ Is widely accepted by enterprise legal teams
- ✅ Is compatible with most open-source licenses

See [LICENSE](LICENSE) for the full license text.

---

## 🔒 Security

Security is a top priority for OpenReg. Key security features include:

| Feature | Implementation |
|---------|----------------|
| **Authentication** | JWT with access/refresh tokens, API keys for M2M |
| **Token Security** | Redis-backed revocation, configurable expiry, issuer/audience validation |
| **Authorization** | Role-based with 50+ granular permissions, wildcard support |
| **Multi-Tenancy** | Automatic row-level tenant isolation |
| **Encryption at Rest** | AES-256 (Fernet) for credentials and secrets |
| **Encryption in Transit** | TLS 1.3 for all network communication |
| **Audit Trail** | 25+ event types with full request context |
| **Rate Limiting** | Redis-backed with configurable limits per tier |
| **Code Sandboxing** | RestrictedPython with allowlisted libraries only |
| **Query Safety** | Timeout enforcement, row limits, SQL injection detection |

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly by emailing [security@openreg.io](mailto:security@openreg.io). Do not open a public issue.

---

## 💬 Community & Support

| Channel | Link | Description |
|---------|------|-------------|
| **GitHub Issues** | [Report bugs](https://github.com/Hansie91/OpenReg/issues) | Bug reports and feature requests |
| **GitHub Discussions** | [Ask questions](https://github.com/Hansie91/OpenReg/discussions) | Community Q&A and ideas |
| **Documentation** | [/docs](docs/) | Comprehensive guides |

### Enterprise Support

For enterprise support inquiries, dedicated SLAs, or professional services, please contact us at [enterprise@openreg.io](mailto:enterprise@openreg.io).

---

## 🙏 Acknowledgments

OpenReg is built on the shoulders of these excellent open-source projects:

- [FastAPI](https://fastapi.tiangolo.com/) — Modern Python web framework
- [React](https://react.dev/) — User interface library
- [PostgreSQL](https://www.postgresql.org/) — Relational database
- [Celery](https://docs.celeryproject.org/) — Distributed task queue
- [Redis](https://redis.io/) — In-memory data store
- [MinIO](https://min.io/) — S3-compatible object storage
- [structlog](https://www.structlog.org/) — Structured logging
- [TailwindCSS](https://tailwindcss.com/) — Utility-first CSS framework

---

<p align="center">
  <strong>Built for the regulatory reporting community</strong>
  <br><br>
  <a href="https://github.com/Hansie91/OpenReg">⭐ Star us on GitHub</a> •
  <a href="https://github.com/Hansie91/OpenReg/issues">🐛 Report an Issue</a> •
  <a href="https://github.com/Hansie91/OpenReg/discussions">💬 Join the Discussion</a>
  <br><br>
  <sub>© 2024-2026 OpenReg Contributors. Licensed under Apache 2.0.</sub>
</p>
