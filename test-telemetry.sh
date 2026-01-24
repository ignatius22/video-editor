#!/bin/bash

# OpenTelemetry Test Script for Video Editor API
# This script generates test traffic to verify distributed tracing in SigNoz

set -e

API_URL="http://localhost:3000"
SIGNOZ_URL="http://localhost:8080"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     OpenTelemetry + SigNoz Test Script                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if API is running
echo -n "1️⃣  Checking API Service... "
if curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start the application with: docker-compose up -d"
    exit 1
fi

# Check if SigNoz is running
echo -n "2️⃣  Checking SigNoz... "
if curl -s "$SIGNOZ_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    echo "   SigNoz UI: $SIGNOZ_URL"
else
    echo -e "${YELLOW}⚠ SigNoz UI not accessible at $SIGNOZ_URL${NC}"
    echo "   Note: Traces will still be collected if the collector is running"
fi

echo ""
echo "3️⃣  Creating test user and logging in..."

# Create test user using Node.js script inside container
docker exec video-editor-api node create-test-user.js 2>/dev/null || echo "   (Skipping user creation)"

# Login to get session cookie (note: API uses cookies, not Bearer tokens)
LOGIN_RESPONSE=$(curl -s -c /tmp/signoz-cookies.txt -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123"
  }')

# Check if login was successful
if echo "$LOGIN_RESPONSE" | grep -q "Logged in successfully"; then
    echo -e "${GREEN}✓ Logged in successfully${NC}"
    # Extract token from cookie file for display
    if [ -f /tmp/signoz-cookies.txt ]; then
        TOKEN=$(grep 'token' /tmp/signoz-cookies.txt | awk '{print $NF}')
        echo "   Session: ${TOKEN:0:20}..."
    fi
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo "4️⃣  Creating test video file..."

# Create a test video file inside Docker container (where FFmpeg is guaranteed to be available)
TEST_VIDEO="test-video-$(date +%s).mp4"
docker exec video-editor-api ffmpeg -f lavfi -i color=black:s=1280x720:d=1 -pix_fmt yuv420p -y "/tmp/$TEST_VIDEO" 2>/dev/null

if [ $? -eq 0 ]; then
    # Copy the video from container to host
    docker cp "video-editor-api:/tmp/$TEST_VIDEO" "$TEST_VIDEO"
    # Clean up inside container
    docker exec video-editor-api rm -f "/tmp/$TEST_VIDEO"
    echo -e "${GREEN}✓ Created: $TEST_VIDEO${NC}"
else
    echo -e "${RED}✗ Failed to create test video${NC}"
    exit 1
fi

echo ""
echo "5️⃣  Uploading video (will trigger FFmpeg: makeThumbnail + getDimensions)..."

UPLOAD_RESPONSE=$(curl -s -b /tmp/signoz-cookies.txt -X POST "$API_URL/api/videos/upload" \
  -H "Content-Type: application/octet-stream" \
  -H "filename: $TEST_VIDEO" \
  --data-binary "@$TEST_VIDEO")

VIDEO_ID=$(echo $UPLOAD_RESPONSE | grep -o '"videoId":"[^"]*' | cut -d'"' -f4)

if [ -z "$VIDEO_ID" ]; then
    echo -e "${RED}✗ Upload failed${NC}"
    echo "Response: $UPLOAD_RESPONSE"
    rm -f "$TEST_VIDEO"
    exit 1
fi

echo -e "${GREEN}✓ Video uploaded${NC}"
echo "   Video ID: $VIDEO_ID"
echo "   📊 Check SigNoz for spans: ffmpeg.makeThumbnail, ffmpeg.getDimensions"

# Wait for processing
sleep 2

echo ""
echo "6️⃣  Triggering video resize (distributed trace: API → Queue → Worker → FFmpeg)..."

RESIZE_RESPONSE=$(curl -s -b /tmp/signoz-cookies.txt -X POST "$API_URL/api/videos/resize" \
  -H "Content-Type: application/json" \
  -d "{
    \"videoId\": \"$VIDEO_ID\",
    \"width\": 640,
    \"height\": 360
  }")

if echo "$RESIZE_RESPONSE" | grep -q '"status":"success"'; then
    echo -e "${GREEN}✓ Resize job queued${NC}"
    echo "   Response: $(echo $RESIZE_RESPONSE | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
    echo "   📊 Check SigNoz for distributed trace:"
    echo "      - HTTP POST /api/videos/resize (video-editor-api)"
    echo "      - queue.enqueue.resize (video-editor-api)"
    echo "      - queue.process.resize (video-editor-worker)"
    echo "      - ffmpeg.resize (video-editor-worker)"
else
    echo -e "${RED}✗ Resize request failed${NC}"
    echo "Response: $RESIZE_RESPONSE"
fi

# Wait for job to process
echo "   ⏳ Waiting 5 seconds for job to process..."
sleep 5

echo ""
echo "7️⃣  Triggering video format conversion (MP4 → WebM)..."

CONVERT_RESPONSE=$(curl -s -b /tmp/signoz-cookies.txt -X POST "$API_URL/api/videos/convert" \
  -H "Content-Type: application/json" \
  -d "{
    \"videoId\": \"$VIDEO_ID\",
    \"targetFormat\": \"webm\"
  }")

if echo "$CONVERT_RESPONSE" | grep -q '"status":"success"'; then
    echo -e "${GREEN}✓ Convert job queued${NC}"
    echo "   Response: $(echo $CONVERT_RESPONSE | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
    echo "   📊 Check SigNoz for span: ffmpeg.convertFormat"
    echo "      - Attributes: ffmpeg.output.format=webm, ffmpeg.video.codec=libvpx-vp9"
else
    echo -e "${YELLOW}⚠ Convert request may have failed (this is okay)${NC}"
    echo "Response: $CONVERT_RESPONSE"
fi

# Cleanup
rm -f "$TEST_VIDEO"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    ✅ Test Complete!                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🔍 View traces in SigNoz:"
echo "   1. Open: $SIGNOZ_URL"
echo "   2. Go to 'Traces' tab"
echo "   3. Filter by service.name = 'video-editor-api' or 'video-editor-worker'"
echo ""
echo "📊 What to look for:"
echo "   ✓ Distributed traces spanning API → Worker services"
echo "   ✓ FFmpeg operation spans with rich attributes:"
echo "     - ffmpeg.operation (resize, convertFormat, etc.)"
echo "     - ffmpeg.video.width, ffmpeg.video.height"
echo "     - ffmpeg.exit_code (should be 0)"
echo "     - ffmpeg.duration_ms"
echo "   ✓ Auto-instrumented spans:"
echo "     - Express HTTP routes"
echo "     - PostgreSQL queries (pg)"
echo "     - Redis operations (ioredis)"
echo ""
echo "🎯 Example trace flow:"
echo "   HTTP POST /api/videos/resize"
echo "   ├─ pg.query SELECT FROM videos"
echo "   ├─ queue.enqueue.resize"
echo "   │  └─ ioredis.lpush"
echo "   └─ queue.process.resize (Worker service)"
echo "      ├─ pg.query UPDATE operations"
echo "      ├─ ffmpeg.resize"
echo "      │  ├─ ffmpeg.video.width: 640"
echo "      │  ├─ ffmpeg.video.height: 360"
echo "      │  └─ ffmpeg.exit_code: 0"
echo "      └─ pg.query UPDATE operations"
echo ""
