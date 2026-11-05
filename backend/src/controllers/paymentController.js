import { z } from 'zod';
import { Course } from '../models/Course.js';
import { Order, PAYMENT_STATUS, COURSE_ACCESS } from '../models/Order.js';
import * as paypal from '../services/paypalService.js';
import * as orderService from '../services/orderService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound, conflict, badGateway } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const createOrderSchema = z.object({
  courseId: z.string().min(1),
  // Optional client-generated key for idempotent retries.
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const captureOrderSchema = z.object({
  orderId: z.string().min(1), // our internal order _id
  paypalOrderId: z.string().min(1).optional(),
});

/**
 * POST /api/payments/create-order
 *
 * 1. Validate the logged-in user (requireAuth) and the course.
 * 2. Read the price SERVER-SIDE from the Course document (never trust the frontend).
 * 3. Call the PayPal create-order API.
 * 4. Persist and return the PayPal order id.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { courseId, idempotencyKey } = req.body;
  const userId = req.user._id;

  // --- 1. Validate course ---
  const course = await Course.findById(courseId);
  if (!course || !course.active) throw notFound('Course not found or inactive', 'COURSE_NOT_FOUND');

  // --- Duplicate-payment protection ---
  // (a) already paid for this course?
  if (await orderService.hasPaidForCourse(userId, courseId)) {
    throw conflict('You have already purchased this course', 'ALREADY_PURCHASED');
  }

  // (b) idempotency: same key returns the same order instead of creating a new one
  if (idempotencyKey) {
    const existingByKey = await Order.findOne({ userId, idempotencyKey });
    if (existingByKey && existingByKey.paypalOrderId) {
      return res.json({
        success: true,
        data: {
          orderId: existingByKey._id,
          paypalOrderId: existingByKey.paypalOrderId,
          amount: existingByKey.amount,
          currency: existingByKey.currency,
          idempotentReplay: true,
        },
      });
    }
  }

  // (c) reuse an existing open order for the same course (avoids orphan PayPal orders)
  let order = await orderService.findOpenOrder(userId, courseId);

  if (!order) {
    order = new Order({
      userId,
      courseId: course._id,
      courseTitle: course.title,
      amount: course.price,          // <-- SERVER-SIDE price, in cents
      currency: course.currency,
      paymentStatus: PAYMENT_STATUS.CREATED,
      courseAccess: COURSE_ACCESS.NO,
      idempotencyKey: idempotencyKey || null,
    });
    order.addEvent('ORDER_CREATED', 'Internal order created');
    await order.save();
  }

  // --- 3. Create the PayPal order ---
  try {
    const paypalOrder = await paypal.createPayPalOrder({
      amount: order.amount,
      currency: order.currency,
      referenceId: String(order._id),
      requestId: idempotencyKey || `create-${order._id}`,
    });

    order.paypalOrderId = paypalOrder.id;
    order.paymentStatus = PAYMENT_STATUS.CREATED;
    order.addEvent('PAYPAL_ORDER_CREATED', `PayPal order ${paypalOrder.id} created`, {
      paypalOrderId: paypalOrder.id,
    });
    await order.save();

    // --- 4. Return the PayPal order id to the frontend ---
    return res.status(201).json({
      success: true,
      data: {
        orderId: order._id,
        paypalOrderId: paypalOrder.id,
        amount: order.amount,
        currency: order.currency,
        courseTitle: order.courseTitle,
      },
    });
  } catch (err) {
    await orderService.markOrderFailed(order, err.message, 'create-order');
    throw err;
  }
});

/**
 * POST /api/payments/capture-order
 *
 * 1. Load our order (must belong to the logged-in user).
 * 2. Call PayPal capture.
 * 3. VERIFY the capture result server-side (status COMPLETED + amount matches).
 * 4. Update the order: captureId, paymentStatus=SUCCESS, courseAccess=YES.
 */
export const captureOrder = asyncHandler(async (req, res) => {
  const { orderId, paypalOrderId } = req.body;
  const userId = req.user._id;

  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw notFound('Order not found', 'ORDER_NOT_FOUND');

  // Idempotency: if already captured, return the stored result.
  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS && order.captureId) {
    return res.json({
      success: true,
      data: { order: order.toPublicJSON(), alreadyCaptured: true },
    });
  }

  const ppOrderId = paypalOrderId || order.paypalOrderId;
  if (!ppOrderId) throw badRequest('No PayPal order id associated with this order', 'MISSING_PAYPAL_ORDER_ID');

  let captureResult;
  try {
    captureResult = await paypal.capturePayPalOrder(ppOrderId, `capture-${order._id}`);
  } catch (err) {
    await orderService.markOrderFailed(order, err.message, 'capture-order');
    throw err;
  }

  // --- 3. Verify the capture result server-side ---
  const verification = verifyCapture(captureResult, order);
  if (!verification.ok) {
    await orderService.markOrderFailed(order, verification.reason, 'capture-order');
    throw badGateway(`Payment verification failed: ${verification.reason}`, 'CAPTURE_VERIFICATION_FAILED', {
      paypalStatus: captureResult?.status,
    });
  }

  // --- 4. Persist success ---
  await orderService.markOrderPaid(order, {
    captureId: verification.captureId,
    paypalOrderId: ppOrderId,
    source: 'capture-order',
  });

  return res.json({ success: true, data: { order: order.toPublicJSON() } });
});

/**
 * Verify a PayPal capture response:
 *  - order status must be COMPLETED
 *  - there must be a capture with status COMPLETED
 *  - the captured amount + currency must match our stored order
 */
export function verifyCapture(captureResult, order) {
  if (!captureResult || captureResult.status !== 'COMPLETED') {
    return { ok: false, reason: `PayPal order status is ${captureResult?.status || 'unknown'}` };
  }

  const unit = captureResult.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) return { ok: false, reason: 'No capture object in PayPal response' };
  if (capture.status !== 'COMPLETED') {
    return { ok: false, reason: `Capture status is ${capture.status}` };
  }

  const capturedValue = Number(capture.amount?.value);
  const expectedValue = order.amount / 100;
  if (Number.isFinite(capturedValue) && Math.abs(capturedValue - expectedValue) > 0.001) {
    return {
      ok: false,
      reason: `Amount mismatch: captured ${capturedValue} ${capture.amount?.currency_code} vs expected ${expectedValue} ${order.currency}`,
    };
  }
  if (capture.amount?.currency_code && capture.amount.currency_code !== order.currency) {
    return { ok: false, reason: `Currency mismatch: ${capture.amount.currency_code} vs ${order.currency}` };
  }

  return { ok: true, captureId: capture.id };
}

/**
 * POST /api/payments/cancel-order
 * Called when the buyer cancels the PayPal window (onCancel) or abandons checkout.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) throw notFound('Order not found', 'ORDER_NOT_FOUND');

  await orderService.markOrderCancelled(order, 'Cancelled by buyer', 'user');
  res.json({ success: true, data: { order: order.toPublicJSON() } });
});

/**
 * POST /api/payments/refund
 * Buyer requests a refund for a paid order (admin approves later).
 */
export const requestRefund = asyncHandler(async (req, res) => {
  const { orderId, reason } = req.body;
  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) throw notFound('Order not found', 'ORDER_NOT_FOUND');

  if (order.paymentStatus !== PAYMENT_STATUS.SUCCESS) {
    throw badRequest('Only successfully paid orders can be refunded', 'NOT_REFUNDABLE');
  }
  if (order.refundStatus === 'REQUESTED' || order.refundStatus === 'COMPLETED') {
    throw conflict('A refund has already been requested for this order', 'REFUND_ALREADY_REQUESTED');
  }

  order.refundStatus = 'REQUESTED';
  order.refundReason = reason || 'Customer requested refund';
  order.addEvent('REFUND_REQUESTED', order.refundReason);
  await order.save();

  res.json({ success: true, data: { order: order.toPublicJSON() } });
});

export default {
  createOrder,
  captureOrder,
  cancelOrder,
  requestRefund,
  verifyCapture,
  createOrderSchema,
  captureOrderSchema,
};
