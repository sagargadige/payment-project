import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

/** 404 handler for unmatched routes. */
export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

/**
 * Central error handler — every create/capture/webhook/frontend flow returns
 * the SAME JSON error shape: { success:false, error:{ code, message, details } }.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong';

  if (statusCode >= 500) {
    logger.error(`[${code}] ${message}`, err.stack || '');
  } else {
    logger.warn(`[${code}] ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details && !env.isProduction ? { details: err.details } : {}),
    },
  });
}

export default { notFoundHandler, errorHandler };
