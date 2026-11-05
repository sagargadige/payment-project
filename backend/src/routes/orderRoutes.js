import { Router } from 'express';
import * as orders from '../controllers/orderController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, orders.listMyOrders);
router.get('/:id', requireAuth, orders.getMyOrder);

export default router;
