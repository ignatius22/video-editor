
Services started:
# Check all containers are running
docker-compose ps

[Telemetry] OpenTelemetry initialized for video-editor-api
./test-telemetry.sh

Open: http://localhost:8080

Navigate to **Traces** → Filter by `service.name = "video-editor-api"`

## Expected Results

You should see:
- ✅ Distributed traces spanning API → Worker
- ✅ FFmpeg operation spans with attributes
# Check if services can reach SigNoz
docker exec video-editor-api ping -c 2 host.docker.internal

# Check logs for errors
docker-compose logs api
docker-compose logs worker


## Clean Everything

docker-compose down -v  # Removes volumes too

---

For detailed testing guide, see: [TELEMETRY-TESTING.md](TELEMETRY-TESTING.md)
