const { createLogger } = require("../utils/logger");

const logger = createLogger("ErrorHandler");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  logger.error("Request failed", {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
  });

  const payload = {
    success: false,
    message: err.message || "Internal Server Error",
  };

  if (process.env.NODE_ENV !== "production" && err.details) {
    payload.details = err.details;
  }

  return res.status(statusCode).json(payload);
}

module.exports = errorHandler;
