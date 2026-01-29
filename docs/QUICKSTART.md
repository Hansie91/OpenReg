# Quick Start Guide

Get OpenRegReport Portal running in under 5 minutes.

**Total time:** 3-5 minutes (depending on internet speed for Docker image pulls)

---

## Prerequisites

### Docker Desktop

Install Docker Desktop from: https://www.docker.com/products/docker-desktop

**Minimum versions:**
- Docker: 20.10+
- Docker Compose: 2.0+

### Verify Installation

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

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

</details>

<details>
<summary><strong>macOS / Linux (bash)</strong></summary>

```bash
# Check Docker
docker --version
# Should show: Docker version 20.10.x or higher

# Check Docker Compose
docker-compose --version
# Should show: Docker Compose version 2.x.x or higher

# Check available ports
lsof -i :3000,:8000,:5432,:6379,:9000 2>/dev/null
# Should return empty (ports available)
```

</details>

---

## Quick Start (Recommended)

Use the start script for the fastest setup experience.

<details>
<summary><strong>Windows</strong></summary>

```powershell
# Navigate to project directory
cd C:\path\to\OpenReg

# Run the start script
.\start.bat
```

The script will:
1. Create `.env` from `.env.example` if needed
2. Start all Docker containers
3. Initialize the database if needed
4. Display access URLs

</details>

<details>
<summary><strong>macOS / Linux</strong></summary>

```bash
# Navigate to project directory
cd /path/to/OpenReg

# Make start script executable (first time only)
chmod +x start.sh

# Run the start script
./start.sh
```

The script will:
1. Create `.env` from `.env.example` if needed
2. Start all Docker containers
3. Initialize the database if needed
4. Display access URLs

</details>

---

## Manual Installation Steps

If you prefer manual setup or the start script doesn't work:

### Step 1: Navigate to Project (~5 seconds)

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
cd C:\path\to\OpenReg
```

</details>

<details>
<summary><strong>macOS / Linux (bash)</strong></summary>

```bash
cd /path/to/OpenReg
```

</details>

### Step 2: Create Environment File (~10 seconds)

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
# Copy the example file
copy .env.example .env

# (Optional) Edit .env to change passwords
notepad .env
```

</details>

<details>
<summary><strong>macOS / Linux (bash)</strong></summary>

```bash
# Copy the example file
cp .env.example .env

# (Optional) Edit .env to change passwords
nano .env
# or
vim .env
```

</details>

### Step 3: Start Services (~30-60 seconds)

This step takes **30-60 seconds** for containers to become healthy.

<details>
<summary><strong>All Platforms</strong></summary>

```bash
# Start all containers in detached mode
docker-compose up -d

# Check status (all should show "healthy" after ~30 seconds)
docker-compose ps
```

</details>

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

### Step 4: Initialize Database (~5-10 seconds)

**First time only.** Choose one option:

#### Option A: Basic Initialization

```bash
docker-compose exec backend python init_db.py
```

#### Option B: With Demo Data (Recommended for First-Time Users)

```bash
docker-compose exec backend python init_db.py --demo
```

This creates:
- Default tenant and admin user
- Demo MiFIR report ready to execute
- 25 sample transactions
- Pre-configured validation rules
- Daily schedule

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

If using `--demo`, you'll also see:
```
Seeding Demo Data for OpenRegReport Portal
...
Demo Data: MiFIR Daily Transaction Report ready to execute
```

---

## Access the Portal

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main application UI |
| **API Docs** | http://localhost:8000/docs | Interactive API documentation |
| **MinIO Console** | http://localhost:9001 | Artifact storage management |

### Default Login Credentials

- **Email:** `admin@example.com`
- **Password:** `admin123`

**Important:** Change these credentials after first login in production environments!

---

## What's Included in Demo Data

When you use `--demo` flag, you get:

| Component | Details |
|-----------|---------|
| **Demo Connector** | PostgreSQL connector pointing to OpenReg database |
| **MiFIR Report** | "MiFIR Daily Transaction Report" with transformation code |
| **Sample Data** | 25 MiFIR transactions in `mifir_demo_transactions` table |
| **Validation Rules** | 5 rules: LEI format, ISIN format, Quantity > 0, Price > 0, Trading capacity |
| **Schedule** | Daily at 6:00 AM (cron: `0 6 * * *`) |

### Execute Your First Report

1. Navigate to http://localhost:3000
2. Login with `admin@example.com` / `admin123`
3. Go to **Reports** in the sidebar
4. Find "MiFIR Daily Transaction Report"
5. Click **Run** to execute
6. View results in **Runs** section

The report will generate XML output from the sample transactions.

---

## Verify Installation

### Test Backend API

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
Invoke-WebRequest -Uri http://localhost:8000/health
```

</details>

<details>
<summary><strong>macOS / Linux (bash) / curl</strong></summary>

```bash
curl http://localhost:8000/health
```

</details>

Expected response:
```json
{"status":"healthy","environment":"development"}
```

### View API Documentation

Navigate to http://localhost:8000/docs - you should see interactive Swagger UI.

### Test Frontend

Navigate to http://localhost:3000 - you should see the login page.

---

## Expected Timings

| Step | First Time | Subsequent |
|------|------------|------------|
| Docker image pull | 2-5 minutes | 0 seconds |
| Services healthy | 30-60 seconds | 10-20 seconds |
| Database init | 5-10 seconds | 0 seconds (skipped) |
| Demo data seed | 5-10 seconds | 0 seconds (idempotent) |
| **Total** | **3-7 minutes** | **~30 seconds** |

---

## What's Running?

| Service | Purpose | Port |
|---------|---------|------|
| **frontend** | React UI (Admin Portal) | 3000 |
| **backend** | FastAPI server | 8000 |
| **worker** | Celery job execution | - |
| **beat** | Celery scheduler | - |
| **postgres** | Metadata database | 5432 |
| **redis** | Job queue | 6379 |
| **minio** | Artifact storage (S3-compatible) | 9000/9001 |

---

## Troubleshooting

### Ports Already in Use

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
# Find what's using port 3000
netstat -ano | findstr ":3000"

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

</details>

<details>
<summary><strong>macOS / Linux (bash)</strong></summary>

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

</details>

Or change ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

### Containers Not Healthy

```bash
# View all logs
docker-compose logs

# View specific service
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f backend
```

### Database Connection Errors

```bash
# Check PostgreSQL status
docker-compose ps postgres
docker-compose logs postgres

# If needed, recreate the database (WARNING: Deletes all data)
docker-compose down -v
docker-compose up -d
docker-compose exec backend python init_db.py --demo
```

### Frontend Not Loading

1. Clear browser cache and hard refresh:
   - **Chrome/Edge:** Ctrl + Shift + R (Windows/Linux) or Cmd + Shift + R (macOS)
   - **Firefox:** Ctrl + F5 (Windows/Linux) or Cmd + Shift + R (macOS)

2. Check frontend logs:
   ```bash
   docker-compose logs frontend
   ```

### "Permission denied" on start.sh (macOS/Linux)

```bash
chmod +x start.sh
./start.sh
```

---

## Stopping Services

### Stop (keeps data)

```bash
docker-compose stop
```

### Start again

```bash
docker-compose start
```

### Stop and remove containers (keeps data)

```bash
docker-compose down
```

### Stop and remove everything (DELETES ALL DATA)

```bash
docker-compose down -v
```

---

## Next Steps

Once everything is running:

1. **Explore the UI**: Check out Dashboard, Reports, Connectors
2. **Execute Demo Report**: Run the MiFIR report from the Reports page
3. **Create Your Own Report**: Follow the patterns in the demo report
4. **Read the Documentation**: See [README.md](../README.md) and [ROADMAP.md](ROADMAP.md)
5. **Try the API**: Use the Swagger UI at http://localhost:8000/docs

---

## Production Deployment

**DO NOT** use this setup for production without:

1. Changing all default passwords in `.env`
2. Enabling TLS/HTTPS
3. Setting up proper secrets management
4. Configuring firewalls
5. See [SECURITY.md](SECURITY.md) for full hardening checklist

For Kubernetes deployment, see [DEPLOYMENT.md](DEPLOYMENT.md) (coming in v1).

---

## Quick Commands Reference

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart service
docker-compose restart backend

# View logs
docker-compose logs -f

# Initialize with demo data
docker-compose exec backend python init_db.py --demo

# Database shell
docker-compose exec postgres psql -U openreg -d openreg

# Check status
docker-compose ps
```

</details>

<details>
<summary><strong>macOS / Linux (bash)</strong></summary>

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart service
docker-compose restart backend

# View logs
docker-compose logs -f

# Initialize with demo data
docker-compose exec backend python init_db.py --demo

# Database shell
docker-compose exec postgres psql -U openreg -d openreg

# Check status
docker-compose ps
```

</details>

---

## Getting Help

- **Documentation**: Check `docs/` directory
- **Logs**: `docker-compose logs [service-name]`
- **API Errors**: Check http://localhost:8000/docs and test endpoints
- **Database Issues**: `docker-compose exec postgres psql -U openreg -d openreg`
