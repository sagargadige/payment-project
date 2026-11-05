import { z } from 'zod';
import { User } from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, unauthorized, conflict } from '../utils/AppError.js';

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /api/auth/register */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_IN_USE');

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();

  const token = signToken(user);
  res.status(201).json({ success: true, data: { token, user: user.toSafeJSON() } });
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  const ok = await user.verifyPassword(password);
  if (!ok) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  const token = signToken(user);
  res.json({ success: true, data: { token, user: user.toSafeJSON() } });
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toSafeJSON() } });
});

export default { register, login, me, registerSchema, loginSchema };
