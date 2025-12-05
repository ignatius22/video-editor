# Observability Stack

Complete observability solution for the video editor microservices with **Metrics, Traces, and Logs**.

## 🎯 The Three Pillars of Observability

```
┌─────────────────────────────────────────────────────┐
│           OBSERVABILITY STACK                       │
├─────────────────┬──────────────────┬────────────────┤
│    METRICS      │     TRACES       │      LOGS      │
│  (Prometheus)   │    (Jaeger)      │     (Loki)     │
│                 │                  │                │
│  What happened? │  Why it happened │  When/Where    │
│  - Request rate │  - Request flow  │  - Debug info  │
│  - Response time│  - Bottlenecks   │  - Errors      │
│  - Error rate   │  - Dependencies  │  - Events      │
│  - Queue depth  │  - Latency       │  - Context     │
└─────────────────┴──────────────────┴────────────────┘
              ↓           ↓                ↓
         ┌────────────────────────────────────┐
         │      Grafana (Visualization)       │
         │    Unified dashboard & alerts      │
         └────────────────────────────────────┘
```

---

## 📊 Components

### 1. **Prometheus** (Port 9090)
**Purpose:** Metrics collection and storage

**What it does:**
- Scrapes metrics from all services every 10-15 seconds
- Stores time-series data
- Evaluates alerting rules
- Provides PromQL query language

**Metrics collected:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `bull_queue_waiting` - Jobs waiting in queue
- `bull_queue_active` - Jobs being processed
- `db_connections_active` - Active database connections
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage

**Access:**
```bash
http://localhost:9090
```

**Example queries:**
```promql
# Request rate per service
rate(http_requests_total[1m])

# p95 response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

---

### 2. **Grafana** (Port 3100)
**Purpose:** Visualization and dashboards

**What it does:**
- Beautiful, interactive dashboards
- Alerts based on metrics
- Unified view of metrics, traces, and logs
- Pre-configured data sources

**Credentials:**
- Username: `admin`
- Password: `admin`

**Access:**
```bash
http://localhost:3100
```

**Dashboards included:**
- **Microservices Overview** - Service health, request rates, response times
- **Queue Monitoring** - Bull queue statistics
- **Database Metrics** - Connection pool usage
- **Error Tracking** - 5xx error rates by service

---

### 3. **Jaeger** (Port 16686)
**Purpose:** Distributed tracing

**What it does:**
- Tracks requests across multiple services
- Shows request flow and timing
- Identifies bottlenecks
- Provides detailed span information

**Access:**
```bash
http://localhost:16686
```

**Example trace:**
```
Upload Video Request [2.3s]
├─ API Gateway [10ms]
├─ Video Service [300ms]
│  ├─ Validate Auth → User Service [50ms]
│  ├─ FFmpeg Thumbnail [150ms]
│  └─ Save to DB → PostgreSQL [100ms]
└─ Job Service [2.0s]
   ├─ Enqueue Job → Redis [10ms]
   └─ Process Video [1.99s]
      ├─ FFmpeg Resize [1.8s]
      └─ Update DB [190ms]
```

---

### 4. **Loki** (Port 3101)
**Purpose:** Log aggregation

**What it does:**
- Centralized log storage
- Log indexing and search
- Correlation with metrics and traces
- Structured logging support

**Access:**
```bash
http://localhost:3101
```

**Query in Grafana:**
```logql
# All logs from user-service
{service="user-service"}

# Error logs across all services
{} |= "error" or "ERROR"

# Logs for specific video
{service="video-service"} |= "videoId=9c1069b5"
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Easiest)

```bash
cd services
docker-compose up -d

# Check all containers are running
docker-compose ps

# Access the dashboards
open http://localhost:3100  # Grafana
open http://localhost:9090  # Prometheus
open http://localhost:16686 # Jaeger
```

### Option 2: Individual Services

```bash
# Start Prometheus
docker run -d -p 9090:9090 \
  -v $(pwd)/observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Start Grafana
docker run -d -p 3100:3000 \
  -v grafana_data:/var/lib/grafana \
  grafana/grafana

# Start Jaeger
docker run -d -p 16686:16686 -p 14268:14268 \
  jaegertracing/all-in-one

# Start Loki
docker run -d -p 3101:3100 \
  -v $(pwd)/observability/loki/loki-config.yml:/etc/loki/local-config.yaml \
  grafana/loki
```

---

## 📈 Using the Observability Stack

### **1. Check Service Health**

**Prometheus:**
```bash
# Check if services are up
curl http://localhost:9090/api/v1/query?query=up
```

**Grafana:**
- Go to http://localhost:3100
- Open "Microservices Overview" dashboard
- See real-time service status

### **2. Monitor Request Rates**

**PromQL query:**
```promql
rate(http_requests_total[1m])
```

**What it shows:**
- Requests per second for each service
- Breakdown by endpoint and method

### **3. Track Response Times**

**PromQL query:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**What it shows:**
- p95 response time (95% of requests faster than this)
- Identifies slow endpoints

### **4. Detect Errors**

**PromQL query:**
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

**What it shows:**
- Error rate per service
- Alerts when threshold exceeded

### **5. Trace a Request**

**In Jaeger:**
1. Go to http://localhost:16686
2. Select service: `api-gateway`
3. Click "Find Traces"
4. Click on a trace to see full request flow

### **6. Search Logs**

**In Grafana:**
1. Go to Explore
2. Select "Loki" data source
3. Query: `{service="video-service"} |= "error"`
4. See all error logs from video service

---

## 🔔 Alerting

### **Alert Rules** (observability/prometheus/alerts.yml)

**Critical Alerts:**
- `ServiceDown` - Service unavailable for >1 minute
- `HighErrorRate` - Error rate >5% for >5 minutes

**Warning Alerts:**
- `HighResponseTime` - p95 response time >1s
- `HighCPUUsage` - CPU usage >80%
- `QueueBacklog` - >100 jobs waiting
- `DatabaseConnectionPoolNearLimit` - >80% pool usage

**Testing alerts:**
```bash
# Trigger high error rate
for i in {1..100}; do
  curl http://localhost:3000/api/invalid-endpoint
done

# Check Prometheus alerts
curl http://localhost:9090/api/v1/alerts
```

---

## 📊 Dashboard Panels

### **Service Health Panels**
Shows if each service is up (1) or down (0):
```promql
up{service="user-service"}
up{service="video-service"}
up{service="job-service"}
up{service="api-gateway"}
```

### **Request Rate Panel**
Shows requests per second:
```promql
rate(http_requests_total[1m])
```

### **Response Time Panel**
Shows p50 and p95 latency:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))
```

### **Error Rate Panel**
Shows percentage of 5xx errors:
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

### **Queue Status Panel**
Shows Bull queue metrics:
```promql
bull_queue_waiting
bull_queue_active
bull_queue_completed
bull_queue_failed
```

---

## 🔍 Troubleshooting

### **Problem: No metrics showing in Grafana**

**Check:**
1. Are services exposing `/metrics` endpoint?
   ```bash
   curl http://localhost:3001/metrics
   ```

2. Is Prometheus scraping services?
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

3. Check Prometheus logs:
   ```bash
   docker-compose logs prometheus
   ```

### **Problem: Prometheus can't reach services**

**Fix:**
- Ensure all services are in the same Docker network
- Check `prometheus.yml` has correct service URLs
- Services should use service names, not localhost

### **Problem: Grafana shows "No Data"**

**Check:**
1. Data source configured correctly
2. Prometheus is receiving metrics
3. Time range is correct (last 1 hour)

### **Problem: High memory usage**

**Prometheus retention:**
```yaml
# In prometheus.yml
global:
  retention: 15d  # Reduce from default 15 days to 7 days
```

---

## 📚 Best Practices

### **1. Metric Naming**
```
<namespace>_<name>_<unit>_<suffix>

Examples:
- http_requests_total (counter)
- http_request_duration_seconds (histogram)
- bull_queue_waiting (gauge)
```

### **2. Label Usage**
```javascript
// Good - Finite label values
httpRequests.labels('user-service', 'GET', '/login', '200')

// Bad - Unbounded label values (causes cardinality explosion)
httpRequests.labels('user-service', 'GET', '/users/12345', '200')
```

### **3. Alert Thresholds**
- Start conservative (avoid alert fatigue)
- Base on historical data
- Use percentiles (p95, p99) not averages

### **4. Dashboard Organization**
- Overview dashboard first
- Drill-down dashboards per service
- Separate dashboards for infrastructure

---

## 🎓 Learning Resources

**PromQL:**
- https://prometheus.io/docs/prometheus/latest/querying/basics/
- https://promlens.com/

**Grafana:**
- https://grafana.com/docs/grafana/latest/
- https://grafana.com/grafana/dashboards/

**Jaeger:**
- https://www.jaegertracing.io/docs/

**Observability:**
- https://www.honeycomb.io/what-is-observability
- https://sre.google/books/

---

## 🔗 URLs Summary

| Service | URL | Purpose |
|---------|-----|---------|
| **Prometheus** | http://localhost:9090 | Metrics & Alerts |
| **Grafana** | http://localhost:3100 | Dashboards (admin/admin) |
| **Jaeger** | http://localhost:16686 | Distributed Tracing |
| **Loki** | http://localhost:3101 | Log Aggregation |
| **User Service** | http://localhost:3001/metrics | Metrics endpoint |
| **Video Service** | http://localhost:3002/metrics | Metrics endpoint |
| **Job Service** | http://localhost:3003/metrics | Metrics endpoint |
| **API Gateway** | http://localhost:3000/metrics | Metrics endpoint |

---

**Status:** ✅ Production Ready
**Last Updated:** December 2025
