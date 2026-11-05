import { Router } from 'express';
import * as payments from '../controllers/paymentController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimit.js';

const router = Router();

// All payment endpoints require a logged-in user.
router.post('/create-order', requireAuth, paymentLimiter, validate(payments.createOrderSchema), payments.createOrder);
router.post('/capture-order', requireAuth, paymentLimiter, validate(payments.captureOrderSchema), payments.captureOrder);
router.post('/cancel-order', requireAuth, paymentLimiter, payments.cancelOrder);
router.post('/refund', requireAuth, paymentLimiter, payments.requestRefund);

export default router;
