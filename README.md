# OpenRegReport Portal

**Open-source, browser-accessible regulatory reporting platform**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub](https://img.shields.io/badge/GitHub-Hansie91%2FOpenReg-blue)](https://github.com/Hansie91/OpenReg)

OpenRegReport Portal is a self-hosted web application that allows organizations to configure and run regulatory report generation workflows end-to-end—without code changes for most configuration. Built with production-readiness and extensibility in mind.

## ✨ Features

### Core Platform
- 🔐 **Browser Portal UI**: Full-featured web interface for all operations
- 📅 **Scheduling & Triggers**: Cron schedules, event triggers, manual execution
- 🐍 **Python Report Logic**: Sandboxed Python code editor with syntax highlighting
- 🗄️ **Universal DB Connectivity**: PostgreSQL, SQL Server, Oracle, MySQL, ODBC
- 🔄 **Cross-Reference Mappings**: Manage code translations with audit trails
- ✅ **Validation Engine**: Rule engine with blocking/warning validations and exception queue
- 📤 **SFTP/FTP Delivery**: Automated delivery to regulators
- 🔒 **Security First**: RBAC, credential encryption, full audit logging

### Report Editor
- 📝 **Monaco Code Editor**: Full-featured Python editor with IntelliSense
- 🔢 **Semantic Versioning**: Major/minor versioning with version history
- ⚡ **Live Execution**: Execute reports directly from the editor
- 📊 **Output Config**: Configurable output formats and file naming

### Output Configuration
- 📄 **Multiple Formats**: XML, JSON, CSV, TXT (fixed-width)
- 📁 **File Splitting**: By record count or file size (MB)
- 🏷️ **Filename Generator**: Configurable templates with tokens:
  - Report name, business date, version number
  - Sequence numbers, timestamps
  - Custom prefix/suffix
  - Multiple date formats (YYYYMMDD, YYYY-MM-DD, etc.)
- ⚙️ **Format-Specific Options**:
  - CSV: Delimiter, quote character, header row
  - XML: Root element, declaration, pretty print
  - JSON: Pretty print, array wrapping
  - TXT: Record length, padding, line endings

### Administration
- 👥 **User Management**: Create/edit users, assign roles
- 🏢 **Multi-Tenant Ready**: PostgreSQL RLS for tenant isolation
- 📋 **Exception Queue**: Review and correct validation failures
- 📈 **Dashboard**: Execution statistics and daily summaries

## 🌍 Regulatory Regimes Roadmap

The following regulatory reporting regimes are in development for the portal:

### United States
| Regime | Regulator | Status |
|--------|-----------|--------|
| **CFTC** | Commodity Futures Trading Commission (CFTC Rewrite) | 🔄 Planned |
| **SEC** | Securities and Exchange Commission | 🔄 Planned |

### European Union
| Regime | Description | Status |
|--------|-------------|--------|
| **EU EMIR** | European Market Infrastructure Regulation (EMIR Refit) | 🔄 In Development |
| **EU MiFIR** | Markets in Financial Instruments Regulation | ✅ Active |

### United Kingdom
| Regime | Description | Status |
|--------|-------------|--------|
| **UK EMIR** | UK European Market Infrastructure Regulation (UK EMIR Refit) | 🔄 Planned |
| **UK MiFIR** | UK Markets in Financial Instruments Regulation | 🔄 In Development |

### Asia-Pacific
| Regime | Regulator | Status |
|--------|-----------|--------|
| **Japan** | Financial Services Agency (JFSA) | 🔄 Planned |
| **Australia** | Australian Securities and Investments Commission (ASIC) | 🔄 Planned |
| **Singapore** | Monetary Authority of Singapore (MAS) | 🔄 Planned |
| **Hong Kong** | Hong Kong Monetary Authority (HKMA) | 🔄 Planned |

### Other Jurisdictions
| Regime | Regulator | Status |
|--------|-----------|--------|
| **Canada** | Canadian Securities Administrators (CSA) | 🔄 Planned |
| **Switzerland** | Swiss Financial Market Supervisory Authority (FINMA/FinfraG) | 🔄 Planned |

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended)
- Ports 3000, 8000, 5432, 6379, 9000 available

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Hansie91/OpenReg.git
   cd OpenReg
   ```

2. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Initialize database** (first time only):
   ```bash
   docker-compose exec backend python init_db.py
   ```

5. **Access the portal**:
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs
   - MinIO Console: http://localhost:9001

### Default Credentials

**Portal Login:**
- Email: `admin@example.com`
- Password: `admin123`

**MinIO Console:**
- Username: `minioadmin`
- Password: `minioadmin`

> ⚠️ **IMPORTANT**: Change all default passwords before production deployment!

## 📖 Usage

### Creating Your First Report

1. **Add a Database Connector**
   - Navigate to **Connectors** → **Add Connector**
   - Enter connection details for your database
   - Test the connection

2. **Create a Report**
   - Go to **Reports** → **Create Report**
   - Name your report (e.g., "MiFIR Transaction Report")
   - Add a description

3. **Configure Report Settings**
   - Click **Edit** on your report
   - **Code Tab**: Write Python transformation code
   - **Output Config Tab**: Select format (XML/JSON/CSV/TXT) and configure naming
   - **History Tab**: View version history and execution statistics

4. **Execute the Report**
   - Click **Execute** to run manually
   - Select business date range
   - View results in the execution modal
   - Download generated artifacts

5. **Schedule Regular Execution**
   - Go to **Schedules**
   - Create cron or calendar-based schedule
   - Link to your report

### Python Code Structure

```python
# Query transactions using injected query_db function
query = """
    SELECT * FROM mifir_transactions
    WHERE business_date BETWEEN %s AND %s
    ORDER BY trading_date_time
"""

df = query_db(query, [parameters['business_date_from'], parameters['business_date_to']])
log(f"Retrieved {len(df)} transactions")

# Transform data as needed
# ...

# Assign to 'result' - this is what gets output
result = df.to_dict('records')
```

**Available Functions:**
- `query_db(sql, params)` - Execute SQL query, returns DataFrame
- `log(message)` - Log messages during execution
- `get_mapping(name, value)` - Cross-reference lookup
- `parameters` - Dict with business_date_from, business_date_to, etc.

## 🏗️ Architecture

```
┌─────────────┐
│   Browser   │
│   (React)   │
└──────┬──────┘
       │ HTTPS
┌──────▼──────┐
│   FastAPI   │──┐
│   Backend   │  │
└──────┬──────┘  │
       │         │ Job Queue
┌──────▼──────┐  │ (Redis)
│  PostgreSQL │  │
│  (Metadata) │  │
└─────────────┘  │
       │         │
┌──────▼──────┐  │
│   Celery    │◄─┘
│   Workers   │ Execute Reports
└──────┬──────┘
       │
┌──────▼──────┐
│    MinIO    │ Artifact Storage
│    (S3)     │
└─────────────┘
       │
┌──────▼──────┐
│  SFTP/FTP   │ Delivery
│ Destinations│
└─────────────┘
```

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: PostgreSQL 15
- **Job Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)
- **Code Execution**: RestrictedPython (sandboxed)
- **Orchestration**: Docker Compose

## 📚 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)**: Deep dive into system design
- **[Security Model](docs/SECURITY.md)**: Security hardening checklist
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Production deployment (K8s/Helm)
- **[Roadmap](docs/ROADMAP.md)**: MVP → v1 → v2 features
- **[API Documentation](http://localhost:8000/docs)**: Interactive OpenAPI docs

## 🗺️ Feature Roadmap

### ✅ MVP (Completed)
- ✅ Portal UI (Dashboard, Reports, Connectors, Runs)
- ✅ Authentication & RBAC
- ✅ Report CRUD + semantic versioning
- ✅ Database connector management
- ✅ Full report execution pipeline
- ✅ Output format configuration (XML/JSON/CSV/TXT)
- ✅ Configurable filename templates
- ✅ File splitting by records/size
- ✅ Validation engine with exception queue
- ✅ Docker Compose deployment

### 🔄 v1 (In Progress)
- [x] Monaco code editor
- [x] Cross-reference mappings
- [ ] Schedule management (cron + calendar)
- [ ] SFTP/FTP delivery
- [ ] Log streaming
- [ ] Kubernetes/Helm charts

### 📋 v2 (Planned)
- [ ] Multi-tenant isolation (PostgreSQL RLS)
- [ ] Approval workflows
- [ ] Data lineage tracking
- [ ] Advanced RBAC (field-level permissions)
- [ ] External auth (OIDC/SAML)
- [ ] Observability (metrics, traces)
- [ ] Plugin marketplace
- [ ] XBRL taxonomy management

## 🧪 Development

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

### Why Apache 2.0?

- ✅ Permissive (allows commercial use, modification, distribution)
- ✅ Explicit patent grant (protects users from patent claims)
- ✅ Enterprise-friendly (widely accepted by corporate legal teams)
- ✅ Compatible with most open-source licenses

## 🔒 Security

- **Credential Encryption**: Fernet symmetric encryption for DB/SFTP credentials
- **JWT Authentication**: Short-lived access tokens (15min) + refresh tokens (7 days)
- **RBAC**: Role-based access control at API level
- **Audit Logging**: All configuration changes and executions logged
- **Sandboxed Execution**: RestrictedPython with allowlisted libraries only
- **SQL Injection Protection**: Parameterized queries via SQLAlchemy

For production hardening, see [docs/SECURITY.md](docs/SECURITY.md).

## 💡 Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/Hansie91/OpenReg/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Hansie91/OpenReg/discussions)

## 🙏 Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://react.dev/) - UI library
- [Celery](https://docs.celeryproject.org/) - Distributed task queue
- [MinIO](https://min.io/) - S3-compatible object storage
- [PostgreSQL](https://www.postgresql.org/) - Relational database
- [RestrictedPython](https://restrictedpython.readthedocs.io/) - Sandboxed execution

---

**Made with ❤️ for the regulatory reporting community**
