import { Order, PAYMENT_STATUS, COURSE_ACCESS } from '../models/Order.js';
import { logger } from '../utils/logger.js';

/**
 * Order service — all business rules around orders live here so the
 * create-order / capture-order / webhook controllers stay thin and consistent.
 */

/**
 * Mark an order as paid. Idempotent: calling it twice with the same captureId
 * does not create a second effect.
 */
export async function markOrderPaid(order, { captureId, paypalOrderId, source = 'capture' }) {
  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS && order.captureId === captureId) {
    logger.debug(`Order ${order._id} already marked paid with capture ${captureId} — no-op`);
    return order;
  }

  order.paymentStatus = PAYMENT_STATUS.SUCCESS;
  order.courseAccess = COURSE_ACCESS.YES;
  order.captureId = captureId || order.captureId;
  if (paypalOrderId) order.paypalOrderId = paypalOrderId;
  order.failureReason = '';
  order.addEvent('PAYMENT_SUCCESS', `Payment captured via ${source}`, { captureId });
  await order.save();
  logger.info(`Order ${order._id} -> SUCCESS (capture ${captureId})`);
  return order;
}

/** Mark an order as failed (capture declined, API error, etc.). */
export async function markOrderFailed(order, reason, source = 'capture') {
  // Never downgrade a successful payment.
  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS) return order;

  order.paymentStatus = PAYMENT_STATUS.FAILED;
  order.courseAccess = COURSE_ACCESS.NO;
  order.failureReason = reason || 'Payment failed';
  order.addEvent('PAYMENT_FAILED', reason || 'Payment failed', { source });
  await order.save();
  logger.warn(`Order ${order._id} -> FAILED (${reason})`);
  return order;
}

/** Mark an order as cancelled. */
export async function markOrderCancelled(order, reason = 'Cancelled by user', source = 'user') {
  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS) return order;
  order.paymentStatus = PAYMENT_STATUS.CANCELLED;
  order.courseAccess = COURSE_ACCESS.NO;
  order.failureReason = reason;
  order.addEvent('ORDER_CANCELLED', reason, { source });
  await order.save();
  return order;
}

/**
 * Find an existing open order for (user, course) to prevent duplicate payments.
 * Returns the most recent order that is not yet SUCCESS/REFUNDED.
 */
export async function findOpenOrder(userId, courseId) {
  return Order.findOne({
    userId,
    courseId,
    paymentStatus: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] },
  }).sort({ createdAt: -1 });
}

/** Has the user already paid for this course? */
export async function hasPaidForCourse(userId, courseId) {
  const paid = await Order.findOne({
    userId,
    courseId,
    paymentStatus: PAYMENT_STATUS.SUCCESS,
  });
  return Boolean(paid);
}

export default {
  markOrderPaid,
  markOrderFailed,
  markOrderCancelled,
  findOpenOrder,
  hasPaidForCourse,
};
