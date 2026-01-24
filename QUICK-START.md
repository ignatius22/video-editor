# Quick Start - OpenTelemetry Testing

## 1. Build Docker Images

```bash
docker-compose build
```

This will install all OpenTelemetry dependencies.

## 2. Start All Services

```bash
docker-compose up -d
```

Services started:
- ✅ API Service (port 3000)
- ✅ Worker Service (2 instances)
- ✅ PostgreSQL Database (port 5432)
- ✅ Redis Queue (port 6379)

## 3. Verify Services

```bash
# Check all containers are running
docker-compose ps

# Check logs
docker-compose logs -f
```

Look for telemetry initialization:
```
[Telemetry] OpenTelemetry initialized for video-editor-api
[Telemetry] Exporting to: host.docker.internal:4317
[Telemetry] Sampling probability: 1
```

## 4. Run Test Script

```bash
./test-telemetry.sh
```

## 5. View Traces in SigNoz

Open: http://localhost:8080

Navigate to **Traces** → Filter by `service.name = "video-editor-api"`

## Expected Results

You should see:
- ✅ Distributed traces spanning API → Worker
- ✅ FFmpeg operation spans with attributes
- ✅ Auto-instrumented Express, PostgreSQL, Redis spans

## Troubleshooting

**No traces in SigNoz?**
```bash
# Check if services can reach SigNoz
docker exec video-editor-api ping -c 2 host.docker.internal

# Verify OTEL is enabled
docker exec video-editor-api env | grep OTEL_ENABLED
```

**Services not starting?**
```bash
# Check logs for errors
docker-compose logs api
docker-compose logs worker

# Rebuild if needed
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Stop Services

```bash
docker-compose down
```

## Clean Everything

```bash
docker-compose down -v  # Removes volumes too
```

---

For detailed testing guide, see: [TELEMETRY-TESTING.md](TELEMETRY-TESTING.md)
