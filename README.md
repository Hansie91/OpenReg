# OpenRegReport Portal

**Open-source, browser-accessible regulatory reporting platform**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

OpenRegReport Portal is a self-hosted web application that allows organizations to configure and run regulatory report generation workflows end-to-end—without code changes for most configuration. Built with production-readiness and extensibility in mind.

## ✨ Features

- 🔐 **Browser Portal UI**: Everything manageable from the web interface
- 📅 **Scheduling & Triggers**: Cron schedules, event triggers, manual execution
- 🐍 **Python Report Logic**: Author transformation code directly in the portal
- 🗄️ **Universal DB Connectivity**: PostgreSQL, SQL Server, Oracle, MySQL, ODBC
- 🔄 **Cross-Reference Mappings**: Manage code translations with audit trails
- ✅ **Pre-Validations**: Rule engine with blocking/warning validations
- 📤 **SFTP/FTP Delivery**: Automated delivery to regulators
- 🔒 **Security First**: RBAC, credential encryption, audit logging
- 📦 **Docker-Based**: One-command deployment
- 🔌 **Extensible**: Plugin system for connectors and validations

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended)
- Ports 3000, 8000, 5432, 6379, 9000 available

### Installation

1. **Clone the repository** (or download this directory):
   ```bash
   cd C:\Users\Hans\OneDrive\Map\OpenReg
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

3. **Add Python Transformation Code**
   - Click **Edit** on your report
   - Write Python code to transform your data
   - Select the connector as data source

4. **Execute the Report**
   - Click **Execute** to run manually
   - View results in **Runs** tab
   - Download generated artifacts

5. **Schedule Regular Execution** (Coming in v1)
   - Go to **Schedules**
   - Create cron or calendar-based schedule

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
       │         │
┌──────▼──────┐  │ Job Queue
│  PostgreSQL │  │ (Redis)
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
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: PostgreSQL 15
- **Job Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)
- **Orchestration**: Docker Compose

## 📚 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)**: Deep dive into system design
- **[Security Model](docs/SECURITY.md)**: Security hardening checklist
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Production deployment (K8s/Helm)
- **[Roadmap](docs/ROADMAP.md)**: MVP → v1 → v2 features
- **[API Documentation](http://localhost:8000/docs)**: Interactive OpenAPI docs

## 🗺️ Roadmap

### MVP (Current)
- ✅ Portal UI (Dashboard, Reports, Connectors, Runs)
- ✅ Authentication & RBAC
- ✅ Report CRUD + versioning
- ✅ Database connector management
- ✅ Job execution (stub)
- ✅ Docker Compose deployment

### v1 (Next)
- [ ] Full report execution pipeline
- [ ] Python code editor with Monaco
- [ ] Cross-reference mappings UI
- [ ] Validation rule builder
- [ ] Schedule management (cron + calendar)
- [ ] SFTP/FTP delivery
- [ ] Artifact download
- [ ] Log streaming
- [ ] Kubernetes/Helm charts

### v2 (Future)
- [ ] Multi-tenant isolation (PostgreSQL RLS)
- [ ] Approval workflows
- [ ] Data lineage tracking
- [ ] Advanced RBAC (field-level permissions)
- [ ] External auth (OIDC/SAML)
- [ ] Observability (metrics, traces)
- [ ] Plugin marketplace

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
- **Sandboxed Execution**: Workers run in isolated Docker containers
- **SQL Injection Protection**: Parameterized queries via SQLAlchemy

For production hardening, see [docs/SECURITY.md](docs/SECURITY.md).

## 💡 Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/yourorg/openreg/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourorg/openreg/discussions)

## 🙏 Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://react.dev/) - UI library
- [Celery](https://docs.celeryproject.org/) - Distributed task queue
- [MinIO](https://min.io/) - S3-compatible object storage
- [PostgreSQL](https://www.postgresql.org/) - Relational database

---

**Made with ❤️ for the regulatory reporting community**
