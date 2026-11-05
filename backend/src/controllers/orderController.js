import { Order } from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/AppError.js';

/** GET /api/orders — the logged-in user's order history. */
export const listMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { orders: orders.map((o) => o.toPublicJSON()) } });
});

/** GET /api/orders/:id — a single order (invoice / confirmation screen). */
export const getMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw notFound('Order not found', 'ORDER_NOT_FOUND');
  res.json({ success: true, data: { order: order.toPublicJSON() } });
});

export default { listMyOrders, getMyOrder };
