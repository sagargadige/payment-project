/**
 * Wrap an async route handler so thrown errors reach the central error handler
 * without a try/catch in every controller.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
