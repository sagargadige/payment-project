/**
 * Application error with an HTTP status code and a stable machine-readable code.
 * Every controller throws these so the central error handler can respond
 * consistently across create-order / capture-order / webhook / frontend flows.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export const badRequest = (msg, code = 'BAD_REQUEST', details) => new AppError(msg, 400, code, details);
export const unauthorized = (msg = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(msg, 401, code);
export const forbidden = (msg = 'Forbidden', code = 'FORBIDDEN') => new AppError(msg, 403, code);
export const notFound = (msg = 'Resource not found', code = 'NOT_FOUND') => new AppError(msg, 404, code);
export const conflict = (msg, code = 'CONFLICT', details) => new AppError(msg, 409, code, details);
export const badGateway = (msg, code = 'UPSTREAM_ERROR', details) => new AppError(msg, 502, code, details);

export default AppError;
