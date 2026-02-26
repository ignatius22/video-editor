
Services started:
# Check all containers are running
docker-compose ps

[Telemetry] OpenTelemetry initialized for convertix-api
./test-telemetry.sh

Open: http://localhost:8080

Navigate to **Traces** → Filter by `service.name = "convertix-api"`

## Expected Results

You should see:
- ✅ Distributed traces spanning API → Worker
- ✅ FFmpeg operation spans with attributes
# Check if services can reach SigNoz
docker exec convertix-api ping -c 2 host.docker.internal

# Check logs for errors
docker-compose logs api
docker-compose logs worker


## Clean Everything

docker-compose down -v  # Removes volumes too

---

For detailed testing guide, see: [TELEMETRY-TESTING.md](TELEMETRY-TESTING.md)
