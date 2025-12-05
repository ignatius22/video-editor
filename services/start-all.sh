#!/bin/bash

# Start All Microservices (Local Development)
# This script starts all services in separate terminal windows

echo "🚀 Starting Video Editor Microservices..."
echo ""

# Check if services directory exists
if [ ! -d "$(dirname "$0")" ]; then
  echo "❌ Error: services directory not found"
  exit 1
fi

cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to start a service in background
start_service() {
  local service_name=$1
  local service_dir=$2
  local port=$3

  echo -e "${BLUE}Starting ${service_name}...${NC}"

  cd "$service_dir"

  # Create .env from .env.example if it doesn't exist
  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${YELLOW}  ✓ Created .env from .env.example${NC}"
  fi

  # Install dependencies if node_modules doesn't exist
  if [ ! -d node_modules ]; then
    echo -e "${YELLOW}  Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
  fi

  # Start service in background
  npm start > "../logs/${service_name}.log" 2>&1 &
  local pid=$!

  echo -e "${GREEN}  ✓ ${service_name} started (PID: $pid, Port: $port)${NC}"
  echo "$pid" > "../pids/${service_name}.pid"

  cd ..
}

# Create logs and pids directories
mkdir -p logs pids

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start services in order
start_service "user-service" "user-service" "3001"
sleep 2

start_service "video-service" "video-service" "3002"
sleep 2

start_service "job-service" "job-service" "3003"
sleep 2

start_service "api-gateway" "api-gateway" "3000"
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Service Status:"
echo "  • User Service:    http://localhost:3001"
echo "  • Video Service:   http://localhost:3002"
echo "  • Job Service:     http://localhost:3003"
echo "  • API Gateway:     http://localhost:3000"
echo ""
echo "Logs:"
echo "  tail -f logs/*.log"
echo ""
echo "Stop all services:"
echo "  ./stop-all.sh"
echo ""
