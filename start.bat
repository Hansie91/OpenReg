@echo off
REM OpenRegReport Portal - Windows Startup Script

echo ========================================
echo OpenRegReport Portal - Quick Start
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/4] Checking environment file...
if not exist .env (
    echo Creating .env from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Review .env and change passwords before production!
    echo.
)

echo [2/4] Starting Docker containers...
docker-compose up -d

echo.
echo [3/4] Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

echo.
echo [4/4] Checking if database is initialized...
docker-compose exec -T backend python -c "from database import SessionLocal; from models import Tenant; db = SessionLocal(); exists = db.query(Tenant).first() is not None; db.close(); exit(0 if exists else 1)" >nul 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo Database not initialized. Running init script...
    docker-compose exec backend python init_db.py
) else (
    echo Database already initialized.
)

echo.
echo ========================================
echo OpenRegReport Portal is ready!
echo ========================================
echo.
echo Frontend:  http://localhost:3000
echo API Docs:  http://localhost:8000/docs
echo MinIO:     http://localhost:9001
echo.
echo Default Login:
echo   Email:    admin@example.com
echo   Password: admin123
echo.
echo To view logs:       docker-compose logs -f
echo To stop services:   docker-compose down
echo ========================================
echo.

REM Ask if user wants to open browser
set /p OPEN_BROWSER="Open browser now? (y/n): "
if /i "%OPEN_BROWSER%"=="y" (
    start http://localhost:3000
)

pause
