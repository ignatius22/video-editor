#!/bin/bash

# Convertix - Quick Start Script
# This script helps you start the application quickly

set -e

echo "🎬 Convertix - Quick Start"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check PostgreSQL
echo -n "Checking PostgreSQL... "
if pg_isready > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start PostgreSQL first"
    exit 1
fi

# Check Redis
echo -n "Checking Redis... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start Redis first: redis-server --daemonize yes"
    exit 1
fi

# Check database
echo -n "Checking database... "
if psql -lqt | cut -d \| -f 1 | grep -qw video_editor; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    echo "Creating database..."
    createdb video_editor
    psql video_editor -f database/schema.sql
    echo -e "${GREEN}✓ Database created${NC}"
fi

# Check storage directory
echo -n "Checking storage directory... "
if [ -d "storage" ]; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${YELLOW}Creating storage directory...${NC}"
    mkdir -p storage
    echo -e "${GREEN}✓ Created${NC}"
fi

# Check if dependencies are installed
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ Installed${NC}"
else
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Check frontend build
echo -n "Checking frontend build... "
if [ -f "public/scripts.js" ]; then
    echo -e "${GREEN}✓ Built${NC}"
else
    echo -e "${YELLOW}Building frontend...${NC}"
    cd apps/web
    npm install
    npm run build
    cd ..
    echo -e "${GREEN}✓ Frontend built${NC}"
fi

echo ""
echo -e "${GREEN}All checks passed!${NC}"
echo ""
echo "======================================"
echo "Starting Convertix..."
echo "======================================"
echo ""
echo -e "Server will start on: ${GREEN}http://localhost:8060${NC}"
echo -e "Bull Board: ${GREEN}http://localhost:8060/admin/queues${NC}"
echo ""
echo -e "${YELLOW}Test Credentials:${NC}"
echo "  Username: testuser"
echo "  Password: test123"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the application
npm start
