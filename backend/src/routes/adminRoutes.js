import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Every admin route requires a logged-in admin.
router.use(requireAuth, requireAdmin);

router.get('/stats', admin.getStats);
router.get('/payments', admin.listPayments);
router.get('/refunds', admin.listRefunds);
router.get('/failed-payments', admin.listFailedPayments);
router.post('/orders/:id/cancel', admin.adminCancelOrder);
router.post('/orders/:id/refund', admin.adminRefundOrder);
router.get('/reports/payments.csv', admin.downloadPaymentsReport);
router.get('/reports/refunds.csv', admin.downloadRefundsReport);

export default router;
