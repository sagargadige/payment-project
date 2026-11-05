import { badRequest } from '../utils/AppError.js';

/**
 * Validate req.body against a zod schema.
 * Usage: router.post('/x', validate(schema), handler)
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return next(badRequest('Validation failed', 'VALIDATION_ERROR', details));
  }
  req.body = result.data;
  return next();
};

export default validate;
