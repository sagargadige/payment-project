import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { unauthorized, forbidden } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Require a valid JWT. Attaches req.user.
 * Used by /create-order, /capture-order, order history, refunds.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized('Missing Authorization bearer token');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('User no longer exists');

  req.user = user;
  next();
});

/** Require the authenticated user to be an admin. */
export const requireAdmin = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
  return next();
};

export default { requireAuth, requireAdmin };
