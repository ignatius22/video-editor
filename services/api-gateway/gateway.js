const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Service URLs
const SERVICES = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  video: process.env.VIDEO_SERVICE_URL || 'http://localhost:3002',
  job: process.env.JOB_SERVICE_URL || 'http://localhost:3003'
};

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[API Gateway] ${req.method} ${req.path} → Routing...`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'healthy',
    services: SERVICES,
    timestamp: new Date().toISOString()
  });
});

// Service status endpoint
app.get('/api/services/status', async (req, res) => {
  const statuses = {};

  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${url}/health`);
      const data = await response.json();
      statuses[name] = {
        status: 'healthy',
        url,
        ...data
      };
    } catch (error) {
      statuses[name] = {
        status: 'unhealthy',
        url,
        error: error.message
      };
    }
  }

  res.json({
    gateway: 'healthy',
    services: statuses
  });
});

// ============================================
// ROUTE PROXIES
// ============================================

// User Service routes
app.use('/api/auth', createProxyMiddleware({
  target: SERVICES.user,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '' // Remove /api/auth prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] → User Service: ${req.method} ${req.path}`);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] User Service error:', err.message);
    res.status(503).json({
      error: 'User Service unavailable',
      service: 'user-service'
    });
  }
}));

// Video Service routes
app.use('/api/videos', createProxyMiddleware({
  target: SERVICES.video,
  changeOrigin: true,
  pathRewrite: {
    '^/api/videos': '' // Remove /api/videos prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] → Video Service: ${req.method} ${req.path}`);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Video Service error:', err.message);
    res.status(503).json({
      error: 'Video Service unavailable',
      service: 'video-service'
    });
  }
}));

// Job Service routes
app.use('/api/jobs', createProxyMiddleware({
  target: SERVICES.job,
  changeOrigin: true,
  pathRewrite: {
    '^/api/jobs': '' // Remove /api/jobs prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] → Job Service: ${req.method} ${req.path}`);
  },
  onError: (err, req, res) => {
    console.error('[Gateway] Job Service error:', err.message);
    res.status(503).json({
      error: 'Job Service unavailable',
      service: 'job-service'
    });
  }
}));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: 'The requested resource does not exist'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[API Gateway] Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║           API GATEWAY                         ║
║           Port: ${PORT}                           ║
║           Status: Running ✅                   ║
╚═══════════════════════════════════════════════╝

Service Routing:
  /api/auth/*    → User Service    (${SERVICES.user})
  /api/videos/*  → Video Service   (${SERVICES.video})
  /api/jobs/*    → Job Service     (${SERVICES.job})

Endpoints:
  GET  /health              - Gateway health
  GET  /api/services/status - All services status

Rate Limiting: 100 requests / 15 minutes
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[API Gateway] SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[API Gateway] SIGINT signal received: closing HTTP server');
  process.exit(0);
});
