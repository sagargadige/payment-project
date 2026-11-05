import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export default { signToken, verifyToken };
