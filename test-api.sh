#!/bin/bash

# Video Editor Express - API Testing Script
# This script tests all API endpoints

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:8060"
COOKIES_FILE="test-cookies.txt"

echo "🧪 Video Editor Express - API Testing"
echo "======================================"
echo ""

# Test 1: Health Check
echo -e "${BLUE}Test 1: Server Health Check${NC}"
response=$(curl -s -w "\n%{http_code}" $BASE_URL)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server not responding (HTTP $http_code)${NC}"
    echo "Please start the server first: npm start"
    exit 1
fi
echo ""

# Test 2: User Login
echo -e "${BLUE}Test 2: User Login${NC}"
login_response=$(curl -s -X POST $BASE_URL/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "test123"}' \
  -c $COOKIES_FILE)

if echo "$login_response" | grep -q "success\|Login successful"; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "Response: $login_response"
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $login_response"
    echo ""
    echo "Make sure test user exists:"
    echo "psql video_editor -c \"SELECT * FROM users WHERE username='testuser';\""
fi
echo ""

# Test 3: Get User Info
echo -e "${BLUE}Test 3: Get User Info${NC}"
user_response=$(curl -s $BASE_URL/api/user -b $COOKIES_FILE)
if echo "$user_response" | grep -q "username"; then
    echo -e "${GREEN}✓ User info retrieved${NC}"
    echo "Response: $user_response"
else
    echo -e "${YELLOW}⚠ Could not get user info (might need login)${NC}"
    echo "Response: $user_response"
fi
echo ""

# Test 4: Get Videos
echo -e "${BLUE}Test 4: Get Videos List${NC}"
videos_response=$(curl -s $BASE_URL/api/videos -b $COOKIES_FILE)
video_count=$(echo "$videos_response" | jq '. | length' 2>/dev/null || echo "0")
echo -e "${GREEN}✓ Videos retrieved${NC}"
echo "Number of videos: $video_count"
if [ "$video_count" != "0" ]; then
    echo "First video: $(echo "$videos_response" | jq '.[0]' 2>/dev/null || echo "$videos_response")"
fi
echo ""

# Test 5: Bull Board
echo -e "${BLUE}Test 5: Bull Board Dashboard${NC}"
bull_response=$(curl -s -w "\n%{http_code}" $BASE_URL/admin/queues)
http_code=$(echo "$bull_response" | tail -n1)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Bull Board accessible${NC}"
    echo "URL: $BASE_URL/admin/queues"
else
    echo -e "${YELLOW}⚠ Bull Board not accessible (HTTP $http_code)${NC}"
fi
echo ""

# Test 6: Database Check
echo -e "${BLUE}Test 6: Database Connection${NC}"
user_count=$(psql video_editor -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
video_count_db=$(psql video_editor -t -c "SELECT COUNT(*) FROM videos;" 2>/dev/null || echo "0")
echo -e "${GREEN}✓ Database connected${NC}"
echo "Users in database: $(echo $user_count | xargs)"
echo "Videos in database: $(echo $video_count_db | xargs)"
echo ""

# Test 7: Redis Check
echo -e "${BLUE}Test 7: Redis Connection${NC}"
redis_response=$(redis-cli ping 2>/dev/null || echo "FAILED")
if [ "$redis_response" = "PONG" ]; then
    echo -e "${GREEN}✓ Redis connected${NC}"
    queue_count=$(redis-cli LLEN "bull:video-processing:wait" 2>/dev/null || echo "0")
    echo "Jobs in queue: $queue_count"
else
    echo -e "${RED}✗ Redis not connected${NC}"
fi
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}Testing Complete!${NC}"
echo "======================================"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open the app in browser: $BASE_URL"
echo "2. Login with: testuser / test123"
echo "3. Upload a test video (MP4 or MOV)"
echo "4. Monitor queue: $BASE_URL/admin/queues"
echo ""
echo "For video upload test, run:"
echo "  ./test-upload.sh <path-to-video.mp4>"
echo ""

# Cleanup
rm -f $COOKIES_FILE
