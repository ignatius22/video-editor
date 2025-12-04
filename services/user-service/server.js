const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`[User Service] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    service: 'user-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[User Service] Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     USER SERVICE                       ║
║     Port: ${PORT}                         ║
║     Status: Running ✅                  ║
╚════════════════════════════════════════╝

Endpoints:
  POST   /login           - User login
  POST   /logout          - User logout
  GET    /user            - Get user info
  PUT    /user            - Update user
  POST   /validate        - Validate token
  GET    /health          - Health check
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[User Service] SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[User Service] SIGINT signal received: closing HTTP server');
  process.exit(0);
});
