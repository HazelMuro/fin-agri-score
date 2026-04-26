/**
 * Centralized error handler. Any thrown error (or rejected promise in an
 * async route thanks to express-async-errors) flows through here and returns
 * a clean JSON payload instead of crashing the server.
 */

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const message =
    status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, err);
  }

  const payload = {
    error: {
      message,
      code: err.code || undefined,
      details: err.details || undefined,
    },
  };

  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    payload.error.stack = err.stack;
  }

  res.status(status).json(payload);
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
