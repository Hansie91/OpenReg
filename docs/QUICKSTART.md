# Quick Start Guide

Get OpenRegReport Portal running in under 5 minutes.

## Prerequisites Check

Before you begin, ensure you have:

```powershell
# Check Docker
docker --version
# Should show: Docker version 20.10.x or higher

# Check Docker Compose
docker-compose --version
# Should show: Docker Compose version 2.x.x or higher

# Check available ports
netstat -an | findstr "3000 8000 5432 6379 9000"
# Should return empty (ports available)
```

## Installation Steps

### 1. Navigate to Project
```powershell
cd C:\Users\Hans\OneDrive\Map\OpenReg
```

### 2. Create Environment File
```powershell
# Copy the example file
copy .env.example .env

# (Optional) Edit .env to change passwords
notepad .env
```

### 3. Start Services
```powershell
# Start all containers in detached mode
docker-compose up -d

# Check status (all should show "healthy" after ~30 seconds)
docker-compose ps
```

Expected output:
```
NAME                COMMAND                  SERVICE     STATUS          PORTS
openreg-backend     "uvicorn main:app..."    backend     Up (healthy)    0.0.0.0:8000->8000/tcp
openreg-beat        "celery -A worker..."    beat        Up              
openreg-frontend    "docker-entrypoint..."   frontend    Up              0.0.0.0:3000->3000/tcp
openreg-minio       "/usr/bin/docker-e..."   minio       Up (healthy)    0.0.0.0:9000-9001->9000-9001/tcp
openreg-postgres    "docker-entrypoint..."   postgres    Up (healthy)    0.0.0.0:5432->5432/tcp
openreg-redis       "docker-entrypoint..."   redis       Up (healthy)    0.0.0.0:6379->6379/tcp
openreg-worker      "celery -A worker..."    worker      Up              
```

### 4. Initialize Database (First Time Only)
```powershell
# Run initialization script
docker-compose exec backend python init_db.py
```

You should see:
```
Creating database tables...
Creating default tenant...
Creating admin role...
Creating default admin user...

==================================================
Database initialized successfully!
==================================================
Tenant: Default Organization (default)
Admin Email: admin@example.com
Admin Password: admin123
==================================================
```

### 5. Access the Portal
Open your browser to:
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001

### 6. Login
Use the default credentials:
- Email: `admin@example.com`
- Password: `admin123`

## What's Running?

| Service | Purpose | Port |
|---------|---------|------|
| **frontend** | React UI | 3000 |
| **backend** | FastAPI server | 8000 |
| **worker** | Celery job execution | - |
| **beat** | Celery scheduler | - |
| **postgres** | Metadata database | 5432 |
| **redis** | Job queue | 6379 |
| **minio** | Artifact storage | 9000/9001 |

## Verify Installation

### Test Backend API
```powershell
# Windows PowerShell
Invoke-WebRequest -Uri http://localhost:8000/health

# Or use curl
curl http://localhost:8000/health
```

Expected response:
```json
{"status":"healthy","environment":"development"}
```

### View API Documentation
Navigate to http://localhost:8000/docs

You should see interactive Swagger UI with all API endpoints.

### Test Frontend
Navigate to http://localhost:3000

You should see the login page.

## Troubleshooting

### Ports Already in Use
If you get port conflicts:

1. Check what's using the port:
```powershell
netstat -ano | findstr ":3000"
```

2. Either stop the conflicting service or change ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

### Containers Not Healthy
Check logs:
```powershell
# View all logs
docker-compose logs

# View specific service
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f backend
```

### Database Connection Errors
Ensure PostgreSQL is healthy:
```powershell
docker-compose ps postgres
docker-compose logs postgres
```

If needed, recreate the database:
```powershell
docker-compose down -v  # WARNING: Deletes all data
docker-compose up -d
docker-compose exec backend python init_db.py
```

### Frontend Not Loading
Clear browser cache and hard refresh:
- Chrome/Edge: Ctrl + Shift + R
- Firefox: Ctrl + F5

Check frontend logs:
```powershell
docker-compose logs frontend
```

## Stopping Services

### Stop (keeps data)
```powershell
docker-compose stop
```

### Start again
```powershell
docker-compose start
```

### Stop and remove containers (keeps data)
```powershell
docker-compose down
```

### Stop and remove everything (⚠️ DELETES ALL DATA)
```powershell
docker-compose down -v
```

## Next Steps

Once everything is running:

1. **Explore the UI**: Check out Dashboard, Reports, Connectors
2. **Create a Report**: Follow the tutorial in the Dashboard
3. **Read the Documentation**: See [README.md](../README.md) and [ROADMAP.md](ROADMAP.md)
4. **Try the API**: Use the Swagger UI at http://localhost:8000/docs

## Production Deployment

**DO NOT** use this setup for production without:
1. Changing all default passwords
2. Enabling TLS/HTTPS
3. Setting up proper secrets management
4. Configuring firewalls
5. See [SECURITY.md](SECURITY.md) for full hardening checklist

For Kubernetes deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) (coming in v1).

## Getting Help

- **Documentation**: Check `docs/` directory
- **Logs**: `docker-compose logs [service-name]`
- **API Errors**: Check http://localhost:8000/docs and test endpoints
- **Database Issues**: `docker-compose exec postgres psql -U openreg -d openreg`

---

**Quick Commands Reference:**

```powershell
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart service
docker-compose restart backend

# View logs
docker-compose logs -f

# Execute command in container
docker-compose exec backend python init_db.py

# Database shell
docker-compose exec postgres psql -U openreg -d openreg

# Check status
docker-compose ps
```

Enjoy OpenRegReport Portal! 🎉
