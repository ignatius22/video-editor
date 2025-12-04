#!/bin/bash

# Stop All Microservices

echo "🛑 Stopping all microservices..."
echo ""

cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to stop a service
stop_service() {
  local service_name=$1
  local pid_file="pids/${service_name}.pid"

  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")

    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo -e "${GREEN}✓ Stopped ${service_name} (PID: $pid)${NC}"
    else
      echo -e "${RED}✗ ${service_name} not running${NC}"
    fi

    rm "$pid_file"
  else
    echo -e "${RED}✗ ${service_name} PID file not found${NC}"
  fi
}

# Stop all services
stop_service "api-gateway"
stop_service "job-service"
stop_service "video-service"
stop_service "user-service"

echo ""
echo "✅ All services stopped"
echo ""

# Clean up
if [ -d "pids" ] && [ -z "$(ls -A pids)" ]; then
  rmdir pids
fi
