import { Order, PAYMENT_STATUS } from '../models/Order.js';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import * as paypal from '../services/paypalService.js';
import * as orderService from '../services/orderService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, badRequest } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Admin capabilities:
 *  - view payments and refunds
 *  - download reports (CSV)
 *  - cancel orders
 *  - track failed payments
 *  - approve/execute refunds
 */

/** GET /api/admin/payments — all payments (optionally filtered by status). */
export const listPayments = asyncHandler(async (req, res) => {
  const { status, from, to } = req.query;
  const filter = {};
  if (status) filter.paymentStatus = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const orders = await Order.find(filter)
    .populate('userId', 'name email')
    .populate('courseId', 'title')
    .sort({ createdAt: -1 })
    .limit(1000);

  res.json({ success: true, data: { payments: orders.map(adminOrderJSON) } });
});

/** GET /api/admin/refunds — orders with a refund in any state. */
export const listRefunds = asyncHandler(async (_req, res) => {
  const orders = await Order.find({ refundStatus: { $ne: 'NONE' } })
    .populate('userId', 'name email')
    .populate('courseId', 'title')
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: { refunds: orders.map(adminOrderJSON) } });
});

/** GET /api/admin/failed-payments — track failed payments. */
export const listFailedPayments = asyncHandler(async (_req, res) => {
  const orders = await Order.find({ paymentStatus: PAYMENT_STATUS.FAILED })
    .populate('userId', 'name email')
    .populate('courseId', 'title')
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: { failedPayments: orders.map(adminOrderJSON) } });
});

/** GET /api/admin/stats — dashboard summary. */
export const getStats = asyncHandler(async (_req, res) => {
  const [total, success, failed, cancelled, refunded, pending] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ paymentStatus: PAYMENT_STATUS.SUCCESS }),
    Order.countDocuments({ paymentStatus: PAYMENT_STATUS.FAILED }),
    Order.countDocuments({ paymentStatus: PAYMENT_STATUS.CANCELLED }),
    Order.countDocuments({ paymentStatus: PAYMENT_STATUS.REFUNDED }),
    Order.countDocuments({ paymentStatus: PAYMENT_STATUS.PENDING }),
  ]);

  const revenueAgg = await Order.aggregate([
    { $match: { paymentStatus: PAYMENT_STATUS.SUCCESS } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const refundAgg = await Order.aggregate([
    { $match: { refundStatus: 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$refundedAmount' } } },
  ]);

  res.json({
    success: true,
    data: {
      counts: { total, success, failed, cancelled, refunded, pending },
      grossRevenueCents: revenueAgg[0]?.total || 0,
      refundedCents: refundAgg[0]?.total || 0,
    },
  });
});

/** POST /api/admin/orders/:id/cancel — admin cancels an order. */
export const adminCancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS) {
    throw badRequest('Cannot cancel a paid order — issue a refund instead', 'ORDER_ALREADY_PAID');
  }
  await orderService.markOrderCancelled(order, req.body?.reason || 'Cancelled by admin', 'admin');
  res.json({ success: true, data: { order: order.toPublicJSON() } });
});

/** POST /api/admin/orders/:id/refund — admin approves & executes a refund via PayPal. */
export const adminRefundOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.paymentStatus !== PAYMENT_STATUS.SUCCESS || !order.captureId) {
    throw badRequest('Only captured payments can be refunded', 'NOT_REFUNDABLE');
  }
  if (order.refundStatus === 'COMPLETED') {
    throw badRequest('This order has already been refunded', 'ALREADY_REFUNDED');
  }

  const partialCents = req.body?.amountCents ? Number(req.body.amountCents) : undefined;

  const refund = await paypal.refundCapture(
    order.captureId,
    partialCents,
    order.currency,
    `refund-${order._id}`,
  );

  const refundedCents = partialCents || order.amount;
  order.refundId = refund.id;
  order.refundStatus = 'COMPLETED';
  order.refundedAmount = refundedCents;
  order.refundReason = req.body?.reason || order.refundReason || 'Refunded by admin';
  if (refundedCents >= order.amount) {
    order.paymentStatus = PAYMENT_STATUS.REFUNDED;
    order.courseAccess = 'NO';
  }
  order.addEvent('REFUND_COMPLETED', `Refund ${refund.id} executed by admin`, { refundedCents });
  await order.save();

  logger.info(`Admin refunded order ${order._id} (refund ${refund.id})`);
  res.json({ success: true, data: { order: order.toPublicJSON(), refund } });
});

/** GET /api/admin/reports/payments.csv — download a payments report. */
export const downloadPaymentsReport = asyncHandler(async (_req, res) => {
  const orders = await Order.find({})
    .populate('userId', 'name email')
    .populate('courseId', 'title')
    .sort({ createdAt: -1 });

  const header = [
    'OrderID', 'Date', 'Customer', 'Email', 'Course', 'Amount', 'Currency',
    'PaymentStatus', 'CourseAccess', 'PayPalOrderID', 'CaptureID',
    'RefundStatus', 'RefundedAmount', 'FailureReason',
  ];

  const rows = orders.map((o) => [
    o._id,
    o.createdAt?.toISOString(),
    o.userId?.name || '',
    o.userId?.email || '',
    o.courseTitle || o.courseId?.title || '',
    (o.amount / 100).toFixed(2),
    o.currency,
    o.paymentStatus,
    o.courseAccess,
    o.paypalOrderId || '',
    o.captureId || '',
    o.refundStatus,
    (o.refundedAmount / 100).toFixed(2),
    (o.failureReason || '').replace(/[\r\n,]+/g, ' '),
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="payments-report-${Date.now()}.csv"`);
  res.send(csv);
});

/** GET /api/admin/reports/refunds.csv — download a refunds report. */
export const downloadRefundsReport = asyncHandler(async (_req, res) => {
  const orders = await Order.find({ refundStatus: { $ne: 'NONE' } })
    .populate('userId', 'name email')
    .sort({ updatedAt: -1 });

  const header = ['OrderID', 'Date', 'Customer', 'Email', 'Amount', 'Currency', 'RefundStatus', 'RefundID', 'RefundedAmount', 'Reason'];
  const rows = orders.map((o) => [
    o._id,
    o.updatedAt?.toISOString(),
    o.userId?.name || '',
    o.userId?.email || '',
    (o.amount / 100).toFixed(2),
    o.currency,
    o.refundStatus,
    o.refundId || '',
    (o.refundedAmount / 100).toFixed(2),
    (o.refundReason || '').replace(/[\r\n,]+/g, ' '),
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="refunds-report-${Date.now()}.csv"`);
  res.send(csv);
});

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function adminOrderJSON(o) {
  return {
    ...o.toPublicJSON(),
    customer: o.userId ? { _id: o.userId._id, name: o.userId.name, email: o.userId.email } : null,
    course: o.courseId ? { _id: o.courseId._id, title: o.courseId.title } : null,
  };
}

export default {
  listPayments,
  listRefunds,
  listFailedPayments,
  getStats,
  adminCancelOrder,
  adminRefundOrder,
  downloadPaymentsReport,
  downloadRefundsReport,
};
