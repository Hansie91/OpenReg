# Troubleshooting Guide

Quick solutions for common OpenReg issues.

## Quick Diagnostics

Run these commands first to check system status:

```bash
# Check all services
docker-compose ps

# Check logs for errors
docker-compose logs --tail=50 | grep -i error

# Test backend health
curl http://localhost:8000/health

# Test external API health
curl http://localhost:8001/health
```

**Healthy output example:**
```
NAME                  STATUS
openreg-postgres      healthy
openreg-redis         healthy
openreg-minio         healthy
openreg-backend       healthy
openreg-external-api  healthy
openreg-worker        running
openreg-beat          running
openreg-frontend      running
```

---

## Docker & Startup Issues

### Services Won't Start

**Symptoms:** `docker-compose up` hangs or fails immediately

**Diagnostic:**
```bash
docker-compose ps
docker-compose logs
```

**Common causes and solutions:**

| Cause | Solution |
|-------|----------|
| Docker not running | Start Docker Desktop |
| Port conflict | See [Port Already in Use](#port-already-in-use) |
| Out of memory | Increase Docker memory to 4GB+ |
| Missing .env | `cp .env.example .env` |
| Corrupted images | `docker-compose build --no-cache` |

### Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
Error: port is already allocated
```

**Diagnostic - Windows:**
```powershell
netstat -ano | findstr ":8000"
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5432"
```

**Diagnostic - Linux/macOS:**
```bash
lsof -i :8000
lsof -i :3000
lsof -i :5432
```

**Solution - Windows:**
```powershell
# Find process ID (last column in netstat output)
taskkill /PID <pid> /F
```

**Solution - Linux/macOS:**
```bash
kill -9 <pid>
```

**Alternative:** Change port in `docker-compose.yml`:
```yaml
ports:
  - "8080:8000"  # Changed from 8000 to 8080
```

### Container Unhealthy

**Symptoms:** Service shows "unhealthy" in `docker-compose ps`

**Per-service diagnostics:**

#### postgres unhealthy

```bash
docker-compose logs postgres --tail=50
docker-compose exec postgres pg_isready -U openreg
```

**Common causes:**
- Insufficient disk space
- Memory pressure
- Volume permission issues
- Corrupted data directory

**Solution:**
```bash
# Check disk space
docker system df

# Restart postgres
docker-compose restart postgres

# Nuclear option - reset data (WARNING: data loss)
docker-compose down -v
docker-compose up -d
```

#### backend unhealthy

```bash
docker-compose logs backend --tail=50
```

**Common causes:**
- Database not ready yet
- Missing environment variables
- Migration not applied
- Import errors

**Solution:**
```bash
# Wait for postgres to be healthy first
docker-compose exec postgres pg_isready -U openreg

# Then restart backend
docker-compose restart backend

# Apply migrations if needed
docker-compose exec backend alembic upgrade head
```

#### redis unhealthy

```bash
docker-compose logs redis --tail=50
docker-compose exec redis redis-cli ping
```

**Should return:** `PONG`

**Common causes:**
- Memory exhaustion
- Persistence errors

**Solution:**
```bash
docker-compose restart redis
```

#### minio unhealthy

```bash
docker-compose logs minio --tail=50
curl http://localhost:9000/minio/health/live
```

**Common causes:**
- Volume permission issues
- Port conflict

**Solution:**
```bash
docker-compose restart minio
```

---

## Database Issues

### Connection Refused

**Symptoms:**
```
Connection refused
could not connect to server
psycopg2.OperationalError: connection refused
```

**Diagnostic:**
```bash
docker-compose ps postgres
docker-compose exec postgres pg_isready -U openreg
```

**Solution:**
```bash
# Restart postgres
docker-compose restart postgres

# Wait 30 seconds for it to be ready
sleep 30

# Verify connection
docker-compose exec postgres psql -U openreg -d openreg -c "SELECT 1;"
```

### Database Not Initialized

**Symptoms:**
```
relation "users" does not exist
relation "tenants" does not exist
ProgrammingError: relation does not exist
```

**Solution:**
```bash
# Initialize database with schema
docker-compose exec backend python init_db.py

# Or with demo data
docker-compose exec backend python init_db.py --demo
```

### Migration Issues

**Symptoms:**
```
alembic.util.exc.CommandError
FAILED: Target database is not up to date
Column already exists
```

**Diagnostic:**
```bash
docker-compose exec backend alembic current
docker-compose exec backend alembic history
```

**Solution:**
```bash
# Apply pending migrations
docker-compose exec backend alembic upgrade head

# If migrations are stuck, check current state
docker-compose exec backend alembic current --verbose
```

### Database Reset

**When all else fails:**
```bash
# WARNING: This deletes ALL data
docker-compose down -v
docker-compose up -d postgres
sleep 10
docker-compose up -d
docker-compose exec backend python init_db.py --demo
```

---

## Authentication Issues

### 401 Unauthorized

**Symptoms:** API returns 401 on what should be valid requests

**Common causes:**
1. Access token expired (15-minute lifetime)
2. Wrong credentials
3. User account deactivated
4. Token not included in request

**Diagnostic:**
```bash
# Test login endpoint directly
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'
```

**Successful response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Solution:**
```bash
# Get fresh token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# Use token in subsequent requests
curl http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer <access_token>"
```

### 403 Forbidden

**Symptoms:** Logged in but cannot access resource

**Cause:** User lacks required role or permission

**Diagnostic:**
```bash
# Check current user's roles
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

**Solution:**
1. Login to Admin panel (http://localhost:3000)
2. Go to Admin > Users
3. Edit user and assign appropriate role
4. User must logout and login again

**Permission format:** `resource:action`

Examples:
- `report:read` - View reports
- `report:create` - Create reports
- `report:execute` - Execute reports
- `connector:create` - Create connectors
- `*` - Administrator (all permissions)

### Token Refresh Failed

**Symptoms:** Refresh token request returns 401

**Cause:** Refresh token expired (7-day lifetime) or invalidated

**Solution:** User must login again with credentials

---

## API Errors

### 422 Validation Error

**Symptoms:**
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Solution:**
1. Check request body matches expected schema
2. View schema at http://localhost:8000/docs
3. Ensure Content-Type header is `application/json`

**Example valid request:**
```bash
curl -X POST http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Report",
    "description": "Description here",
    "report_type": "regulatory"
  }'
```

### 500 Internal Server Error

**Symptoms:** Server error with no specific message

**Diagnostic:**
```bash
docker-compose logs backend --tail=100 | grep -A5 "ERROR\|Traceback"
```

**Look for:**
- Python traceback
- Database errors
- Import errors
- Configuration issues

**Common fixes:**
```bash
# Restart backend
docker-compose restart backend

# Check environment variables
docker-compose exec backend env | grep -E "DATABASE|REDIS|SECRET"

# Verify database connection
docker-compose exec backend python -c "from database import engine; print(engine.connect())"
```

### 504 Gateway Timeout

**Symptoms:** Request hangs then times out

**Cause:** Long-running operation or deadlock

**Diagnostic:**
```bash
# Check if workers are processing
docker-compose logs worker --tail=50

# Check Redis connection
docker-compose exec redis redis-cli ping
```

**Solution:**
```bash
docker-compose restart worker backend
```

---

## Worker/Celery Issues

### Tasks Not Running

**Symptoms:**
- Report execution hangs
- Jobs queued but not processing
- "Pending" status never changes

**Diagnostic:**
```bash
# Check worker status
docker-compose ps worker beat

# Check worker logs
docker-compose logs worker --tail=50

# Check task queue
docker-compose exec redis redis-cli LLEN celery
```

**Solution:**
```bash
# Restart workers
docker-compose restart worker beat

# If queue is stuck, clear it (WARNING: loses pending tasks)
docker-compose exec redis redis-cli FLUSHDB
docker-compose restart worker beat
```

### Redis Connection Error

**Symptoms:**
```
Error 111 connecting to redis:6379. Connection refused.
kombu.exceptions.OperationalError
```

**Diagnostic:**
```bash
docker-compose ps redis
docker-compose exec redis redis-cli ping
```

**Solution:**
```bash
docker-compose restart redis worker beat
```

### Worker Out of Memory

**Symptoms:**
- Worker killed mid-task
- OOMKilled in docker logs
- Large reports fail

**Diagnostic:**
```bash
docker stats openreg-worker
docker-compose logs worker | grep -i "kill\|memory\|oom"
```

**Solution:**

1. Increase worker memory in `docker-compose.yml`:
```yaml
worker:
  deploy:
    resources:
      limits:
        memory: 8G  # Increased from 4G
```

2. Restart:
```bash
docker-compose up -d worker
```

---

## Frontend Issues

### Blank Page / Not Loading

**Symptoms:** Browser shows white screen or loading forever

**Diagnostic:**
```bash
# Check frontend logs
docker-compose logs frontend --tail=50

# Check if backend is reachable
curl http://localhost:8000/health
```

**Common causes and solutions:**

| Cause | Check | Solution |
|-------|-------|----------|
| API URL wrong | Check VITE_API_URL in .env | Set to `http://localhost:8000` |
| CORS error | Check browser console | Add origin to CORS_ORIGINS |
| Build failed | Check frontend logs | `docker-compose build frontend` |
| Backend down | `curl localhost:8000/health` | `docker-compose restart backend` |

### Login Page Loops

**Symptoms:** Login succeeds but redirects back to login

**Cause:** Token not being stored or API unreachable

**Solution:**
1. Open browser DevTools (F12)
2. Go to Application > Local Storage
3. Clear all items
4. Hard refresh (Ctrl+Shift+R)
5. Try login again

If still failing, check backend health:
```bash
curl http://localhost:8000/health
docker-compose logs backend --tail=20
```

### CORS Errors

**Symptoms:** Browser console shows:
```
Access to fetch at 'http://localhost:8000/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solution:**

1. Check `.env` file:
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

2. Restart backend:
```bash
docker-compose restart backend
```

---

## MinIO/Storage Issues

### Artifacts Not Saving

**Symptoms:**
- Report completes but no artifact
- Download fails with 404
- "Artifact not found" error

**Diagnostic:**
```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Check MinIO logs
docker-compose logs minio --tail=50

# List buckets
docker-compose exec minio mc ls local/
```

**Solution:**
```bash
# Restart MinIO
docker-compose restart minio

# Create bucket if missing
docker-compose exec minio mc mb local/openreg-artifacts --ignore-existing
```

### MinIO Console Not Accessible

**Symptoms:** Cannot access http://localhost:9001

**Diagnostic:**
```bash
docker-compose ps minio
docker-compose logs minio | grep -i "console"
```

**Solution:**
```bash
docker-compose restart minio
```

**Default credentials:**
- Username: `minioadmin`
- Password: `minioadmin`

---

## External API Issues

### External API Not Responding

**Symptoms:** Port 8001 not accessible

**Diagnostic:**
```bash
docker-compose ps external-api
curl http://localhost:8001/health
docker-compose logs external-api --tail=50
```

**Solution:**
```bash
docker-compose restart external-api
```

### Customer Portal Not Loading

**Symptoms:** http://localhost:3001 not accessible

**Diagnostic:**
```bash
docker-compose ps customer-portal
docker-compose logs customer-portal --tail=50
```

**Solution:**
```bash
docker-compose restart customer-portal
```

---

## Complete System Reset

**When all else fails, perform a complete reset:**

```bash
# WARNING: This deletes ALL data including database

# Stop and remove everything
docker-compose down -v

# Remove any orphaned containers
docker container prune -f

# Rebuild images
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Wait for services
sleep 30

# Initialize database with demo data
docker-compose exec backend python init_db.py --demo
```

**Verify system is healthy:**
```bash
docker-compose ps
curl http://localhost:8000/health
curl http://localhost:3000
```

---

## Performance Issues

### Slow API Responses

**Diagnostic:**
```bash
# Check database query performance
docker-compose exec postgres psql -U openreg -d openreg \
  -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"

# Check backend memory
docker stats openreg-backend
```

**Solutions:**
- Add database indexes for common queries
- Increase backend replicas
- Enable query result caching

### High Memory Usage

**Diagnostic:**
```bash
docker stats
```

**Solutions:**
1. Increase Docker memory allocation
2. Reduce concurrent workers
3. Set resource limits in docker-compose.yml

---

## Getting Help

If issues persist after trying these solutions:

1. **Collect diagnostic information:**
```bash
docker-compose logs > debug.log
docker-compose ps >> debug.log
docker version >> debug.log
```

2. **Search existing issues** on GitHub

3. **Open a new issue** with:
   - Docker version (`docker --version`)
   - Docker Compose version (`docker-compose --version`)
   - Operating system and version
   - Full error message
   - Steps to reproduce
   - Relevant logs from `debug.log`

---

## Quick Reference Commands

```bash
# Service status
docker-compose ps

# View logs
docker-compose logs <service>
docker-compose logs --tail=50 --follow

# Restart service
docker-compose restart <service>

# Rebuild and restart
docker-compose up -d --build <service>

# Execute command in container
docker-compose exec <service> <command>

# Health checks
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:9000/minio/health/live

# Database access
docker-compose exec postgres psql -U openreg -d openreg

# Redis CLI
docker-compose exec redis redis-cli

# Complete restart
docker-compose down && docker-compose up -d
```
