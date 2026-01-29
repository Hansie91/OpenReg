#!/bin/bash
#
# OpenRegReport Portal - Unix/macOS Start Script
#
# This script automates the startup process:
# 1. Checks if Docker is running
# 2. Creates .env from .env.example if needed
# 3. Starts all Docker containers
# 4. Waits for health checks
# 5. Initializes the database if needed
# 6. Prints access URLs
#
# Usage:
#   ./start.sh           # Normal start
#   ./start.sh --demo    # Start with demo data (recommended for first-time users)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DEMO_FLAG=""
if [[ "$1" == "--demo" ]]; then
    DEMO_FLAG="--demo"
fi

echo ""
echo "========================================"
echo "OpenRegReport Portal - Quick Start"
echo "========================================"
echo ""

# Step 1: Check if Docker is running
echo -e "${BLUE}[1/5] Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running!${NC}"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo -e "${GREEN}      Docker is running${NC}"

# Step 2: Check if .env exists, create from example if not
echo -e "${BLUE}[2/5] Checking environment file...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "      Creating .env from .env.example..."
        cp .env.example .env
        echo -e "${YELLOW}      IMPORTANT: Review .env and change passwords before production!${NC}"
    else
        echo -e "${RED}ERROR: .env.example not found!${NC}"
        echo "Please ensure you're in the OpenReg project directory."
        exit 1
    fi
else
    echo -e "${GREEN}      .env file exists${NC}"
fi

# Step 3: Start Docker containers
echo -e "${BLUE}[3/5] Starting Docker containers...${NC}"
docker-compose up -d

# Step 4: Wait for services to be healthy
echo -e "${BLUE}[4/5] Waiting for services to be healthy...${NC}"
echo "      This may take 30-60 seconds..."

# Wait for backend to be healthy (with timeout)
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker-compose ps | grep -q "openreg-backend.*healthy"; then
        echo -e "${GREEN}      Backend is healthy${NC}"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
    echo "      Waiting... ($WAITED seconds)"
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}      Warning: Backend health check timed out. Continuing anyway...${NC}"
    echo "      Check logs with: docker-compose logs backend"
fi

# Check other services
if docker-compose ps | grep -q "openreg-postgres.*healthy"; then
    echo -e "${GREEN}      PostgreSQL is healthy${NC}"
fi
if docker-compose ps | grep -q "openreg-redis.*healthy"; then
    echo -e "${GREEN}      Redis is healthy${NC}"
fi
if docker-compose ps | grep -q "openreg-minio.*healthy"; then
    echo -e "${GREEN}      MinIO is healthy${NC}"
fi

# Step 5: Initialize database if needed
echo -e "${BLUE}[5/5] Checking database initialization...${NC}"

# Check if database is already initialized
DB_INITIALIZED=$(docker-compose exec -T backend python -c "
from database import SessionLocal
from models import Tenant
db = SessionLocal()
exists = db.query(Tenant).first() is not None
db.close()
print('yes' if exists else 'no')
" 2>/dev/null || echo "no")

if [ "$DB_INITIALIZED" = "yes" ]; then
    echo -e "${GREEN}      Database already initialized${NC}"

    # If --demo flag was provided, still run seed to ensure demo data exists
    if [ -n "$DEMO_FLAG" ]; then
        echo "      Ensuring demo data exists..."
        docker-compose exec -T backend python init_db.py --demo 2>/dev/null || true
    fi
else
    echo "      Initializing database..."
    if [ -n "$DEMO_FLAG" ]; then
        docker-compose exec -T backend python init_db.py --demo
    else
        docker-compose exec -T backend python init_db.py
    fi
fi

# Print success message
echo ""
echo "========================================"
echo -e "${GREEN}OpenRegReport Portal is ready!${NC}"
echo "========================================"
echo ""
echo "Access URLs:"
echo -e "  Frontend:    ${BLUE}http://localhost:3000${NC}"
echo -e "  API Docs:    ${BLUE}http://localhost:8000/docs${NC}"
echo -e "  MinIO:       ${BLUE}http://localhost:9001${NC}"
echo ""
echo "Default Login:"
echo "  Email:       admin@example.com"
echo "  Password:    admin123"
echo ""
if [ -n "$DEMO_FLAG" ]; then
    echo -e "${GREEN}Demo Data:     MiFIR Daily Transaction Report ready to execute${NC}"
    echo ""
fi
echo "Commands:"
echo "  View logs:       docker-compose logs -f"
echo "  Stop services:   docker-compose down"
echo "========================================"
echo ""

# Ask if user wants to open browser (only if interactive terminal)
if [ -t 0 ]; then
    read -p "Open browser now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Try to open browser based on OS
        if command -v xdg-open > /dev/null; then
            xdg-open http://localhost:3000 2>/dev/null &
        elif command -v open > /dev/null; then
            open http://localhost:3000
        elif command -v start > /dev/null; then
            start http://localhost:3000
        else
            echo "Please open http://localhost:3000 in your browser"
        fi
    fi
fi
