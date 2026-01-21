/**
 * Centralized Error Handler Middleware
 * Catches and formats errors for consistent API responses
 */

const errorHandler = (err, req, res, next) => {
  console.error("[API] Error:", err);

  // Default error
  let status = err.status || 500;
  let message = err.message || "Internal server error";

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = "Unauthorized";
  } else if (err.code === 'ENOENT') {
    status = 404;
    message = "Resource not found";
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
