# Frequently Asked Questions

## Having Issues?

For detailed troubleshooting steps with diagnostic commands, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.

**Quick diagnostic:**
```bash
docker-compose ps          # Check service status
docker-compose logs --tail=50  # Recent logs
curl http://localhost:8000/health  # Backend health
```

---

## Installation & Setup

### Q: What are the system requirements?
**A:** Minimum requirements:
- Windows 10/11, macOS, or Linux
- Docker 20.10+ and Docker Compose 2.0+
- 4GB RAM (8GB recommended)
- 10GB disk space
- Ports 3000, 8000, 5432, 6379, 9000, 9001 available

### Q: How do I start the application?
**A:** 
```powershell
# Windows
.\start.bat

# Or manually
docker-compose up -d
docker-compose exec backend python init_db.py
```

### Q: The containers won't start. What should I check?
**A:** See [Docker & Startup Issues](TROUBLESHOOTING.md#docker--startup-issues) for detailed diagnostics.

Quick checks:
1. Is Docker Desktop running?
2. Are ports available? Run: `netstat -an | findstr "3000 8000"`
3. Check logs: `docker-compose logs`

### Q: I forgot the admin password. How do I reset it?
**A:**
```powershell
# Reset the database (WARNING: Deletes all data)
docker-compose down -v
docker-compose up -d
docker-compose exec backend python init_db.py
```

Or manually update in database:
```powershell
docker-compose exec postgres psql -U openreg -d openreg
# Then: UPDATE users SET hashed_password = '$2b$...' WHERE email = 'admin@example.com';
```

## Usage

### Q: How do I create my first report?
**A:**
1. Login to http://localhost:3000
2. Go to **Connectors** → Add a database connector
3. Go to **Reports** → Create Report
4. (v1) Add Python transformation code
5. Execute the report

### Q: Where are the generated reports stored?
**A:** Artifacts are stored in MinIO (S3-compatible storage):
- Console: http://localhost:9001
- Bucket: `openreg-artifacts`
- Access via API: `/api/v1/runs/{run_id}/artifacts`

### Q: Can I connect to my existing SQL Server database?
**A:** Yes! In the Connectors page:
1. Type: `sqlserver`
2. Config: `{"host": "your-server", "port": 1433, "database": "your-db"}`
3. Credentials: `{"username": "user", "password": "pass"}`

These are encrypted at rest using Fernet.

### Q: How do I schedule a report to run daily?
**A:** This feature is coming in v1. For now, you can:
1. Use the API to trigger manually: `POST /api/v1/reports/{id}/execute`
2. Set up an external cron job to call the API
3. Wait for v1 with built-in scheduling UI

## Security

### Q: Is it safe to use in production?
**A:** The MVP is production-minded but requires hardening:
- ✅ Safe for development/testing
- ⚠️ Requires hardening for production (see `docs/SECURITY.md`)
- 🔒 Must change default passwords
- 🔒 Must enable TLS/HTTPS
- 🔒 Must use proper secrets management (Vault)

### Q: How are database credentials stored?
**A:** Credentials are encrypted using Fernet symmetric encryption:
- Encryption key in environment variable `ENCRYPTION_KEY`
- Never logged in plaintext
- Decrypted only in worker processes (ephemeral)

### Q: Can multiple users access the system?
**A:** Yes! The system supports:
- Multiple users per tenant
- Role-based access control (RBAC)
- Permission-based API access
- Audit logging of all actions

### Q: What permissions can I assign to users?
**A:** Permission format: `resource:action`
Examples:
- `report:create`, `report:read`, `report:execute`
- `connector:create`, `connector:read`
- `*` (wildcard for administrators)

## Development

### Q: How do I add a new database connector type?
**A:** (v1 feature) Create a plugin in `backend/plugins/connectors/`:
```python
class MyDBConnector(BaseConnector):
    def connect(self):
        # Connection logic
        pass
    
    def execute_query(self, sql, params):
        # Query execution
        pass
```

### Q: Can I run the backend and frontend separately?
**A:** Yes, for development:

**Backend:**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

### Q: How do I run tests?
**A:**
```powershell
# Backend (90 tests)
cd backend
pytest

# Frontend (62 tests)
cd frontend
npm test

# E2E tests (requires running services)
cd e2e
npx playwright test
```

See the [CHANGELOG](../CHANGELOG.md) for test coverage details.

### Q: Where can I find API documentation?
**A:** Interactive API docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/api/v1/openapi.json

## Troubleshooting

For detailed troubleshooting with step-by-step diagnostic commands, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.

### Q: Where do I find solutions for common errors?
**A:** The [Troubleshooting Guide](TROUBLESHOOTING.md) covers:
- Docker and startup issues
- Database connection problems
- Authentication errors (401/403)
- API errors (422/500)
- Worker/Celery issues
- Frontend problems
- MinIO storage issues

### Q: How do I check if all services are running?
**A:**
```bash
docker-compose ps
```
All services should show "healthy" or "running" status.

### Q: What are the default credentials?
**A:**
- **Admin login:** admin@example.com / admin123
- **MinIO console:** minioadmin / minioadmin
- **PostgreSQL:** openreg / openreg_dev_password

Change all defaults before production!

## Features

### Q: What's the difference between MVP and v1?
**A:**
- **MVP (current)**: Infrastructure, UI, APIs, data model
- **v1 (5 months)**: Full execution pipeline, SFTP delivery, scheduling, Monaco editor
- **v2 (10 months)**: Multi-tenancy, approval workflows, data lineage

See `docs/ROADMAP.md` for details.

### Q: Can I export reports to XML/JSON/CSV?
**A:** (Coming in v1) The system will support:
- CSV output format
- XML output format
- JSON output format
Configured per report in the report settings.

### Q: Does it support SFTP delivery to regulators?
**A:** (Coming in v1) Features planned:
- SFTP with key or password auth
- FTP/FTPS support
- Retry with exponential backoff
- Delivery confirmation tracking
- Multi-destination routing

## Architecture

### Q: What's the technology stack?
**A:**
- Backend: FastAPI (Python 3.11+)
- Frontend: React 18 + TypeScript + Vite
- Database: PostgreSQL 15
- Queue: Celery + Redis
- Storage: MinIO (S3-compatible)
- Deployment: Docker Compose (MVP), Kubernetes (v1)

### Q: Why Python instead of Java/C#?
**A:** 
- Report transformation logic is typically Python (pandas, etc.)
- Rich ecosystem for data processing
- Simpler for data engineers to extend
- FastAPI provides excellent performance

### Q: Can this run on Kubernetes?
**A:** Yes! Kubernetes manifests coming in v1:
- Helm charts
- Horizontal pod autoscaling
- Persistent volume claims
- Secret management
See `docs/DEPLOYMENT.md` (coming in v1)

### Q: How does it handle large datasets?
**A:** (v1/v2 features)
- Streaming data processing (pandas chunking)
- Worker resource limits (2GB RAM, 2 CPU cores)
- Query timeout enforcement
- Incremental loads (v2)

## Support

### Q: Where can I get help?
**A:**
- Documentation: `docs/` directory
- Logs: `docker-compose logs [service]`
- GitHub Issues: (set up repository)
- Community Discussions: (to be created)

### Q: Can I contribute?
**A:** Yes! Contributions welcome:
1. Check `docs/ROADMAP.md` for priorities
2. Fork the repository
3. Create a feature branch
4. Add tests and documentation
5. Submit a pull request

### Q: Is there commercial support available?
**A:** This is an open-source project under Apache 2.0 license. Commercial support can be arranged separately.

## License

### Q: Can I use this commercially?
**A:** Yes! Apache 2.0 license allows:
- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ✅ Patent grant

### Q: Do I need to open-source my modifications?
**A:** No. Apache 2.0 is permissive - you can keep modifications private. However, contributions back to the project are appreciated!

---

**Can't find your question?** Check:
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Detailed error solutions
- [QUICKSTART.md](QUICKSTART.md) - Installation guide
- [API_GUIDE.md](API_GUIDE.md) - API documentation (if available)
- [SECURITY.md](SECURITY.md) - Security best practices
- [ROADMAP.md](ROADMAP.md) - Feature planning
- [README.md](../README.md) - Project overview
- [CHANGELOG.md](../CHANGELOG.md) - Release history
