import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', apiLimiter, validate(auth.registerSchema), auth.register);
router.post('/login', apiLimiter, validate(auth.loginSchema), auth.login);
router.get('/me', requireAuth, auth.me);

export default router;
