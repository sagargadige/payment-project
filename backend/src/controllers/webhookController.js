import { Order, PAYMENT_STATUS } from '../models/Order.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import * as paypal from '../services/paypalService.js';
import * as orderService from '../services/orderService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/payments/webhook
 *
 * Handles PayPal webhooks. The route is mounted with express.raw() so we can
 * verify the signature against the EXACT raw body.
 *
 * Primary event: PAYMENT.CAPTURE.COMPLETED
 * Also handled:  PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED, CHECKOUT.ORDER.APPROVED
 *
 * Idempotency: every event id is stored in WebhookEvent; a repeat is ignored.
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body.toString('utf8');
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    logger.warn('Webhook received with invalid JSON body');
    return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON' } });
  }

  const eventId = event.id;
  const eventType = event.event_type;
  logger.info(`Webhook received: ${eventType} (${eventId})`);

  // --- 1. Verify the signature with PayPal ---
  let verification;
  try {
    verification = await paypal.verifyWebhookSignature(req.headers, rawBody);
  } catch (err) {
    logger.error('Webhook signature verification error', err.message);
    return res.status(400).json({ success: false, error: { code: 'WEBHOOK_VERIFY_ERROR', message: err.message } });
  }

  if (!verification.verified && !verification.skipped) {
    logger.warn(`Webhook ${eventId} failed signature verification — rejected`);
    return res.status(400).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
  }

  // --- 2. Idempotency: ignore events we have already processed ---
  const existing = await WebhookEvent.findOne({ eventId });
  if (existing?.processed) {
    logger.debug(`Webhook ${eventId} already processed — ack`);
    return res.json({ success: true, data: { received: true, duplicate: true } });
  }

  const record = existing || new WebhookEvent({ eventId, eventType });
  record.verified = Boolean(verification.verified);
  record.payload = event;
  record.resourceId = event.resource?.id || null;
  await record.save();

  // --- 3. Process the event ---
  try {
    await processEvent(event);
    record.processed = true;
    await record.save();
  } catch (err) {
    logger.error(`Error processing webhook ${eventId}`, err.message);
    // Return 200 so PayPal does not retry forever on a logic error we logged;
    // switch to 500 if you prefer PayPal retries.
    return res.json({ success: true, data: { received: true, processed: false } });
  }

  return res.json({ success: true, data: { received: true, processed: true } });
});

async function processEvent(event) {
  const type = event.event_type;
  const resource = event.resource || {};

  switch (type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      // resource is a capture; find our order by paypalOrderId (supplementary_data) or captureId
      const captureId = resource.id;
      const paypalOrderId =
        resource.supplementary_data?.related_ids?.order_id ||
        resource.custom_id ||
        null;

      let order = null;
      if (paypalOrderId) order = await Order.findOne({ paypalOrderId });
      if (!order && captureId) order = await Order.findOne({ captureId });
      if (!order && resource.custom_id) order = await Order.findById(resource.custom_id).catch(() => null);

      if (!order) {
        logger.warn(`PAYMENT.CAPTURE.COMPLETED: no matching order for capture ${captureId}`);
        return;
      }

      await orderService.markOrderPaid(order, {
        captureId,
        paypalOrderId: paypalOrderId || order.paypalOrderId,
        source: 'webhook',
      });
      return;
    }

    case 'PAYMENT.CAPTURE.DENIED': {
      const captureId = resource.id;
      const order = await Order.findOne({ captureId });
      if (order) await orderService.markOrderFailed(order, 'Capture denied (webhook)', 'webhook');
      return;
    }

    case 'PAYMENT.CAPTURE.REFUNDED': {
      const captureId = resource?.supplementary_data?.related_ids?.capture_id || resource.id;
      const order = await Order.findOne({ captureId });
      if (order) {
        order.paymentStatus = PAYMENT_STATUS.REFUNDED;
        order.refundStatus = 'COMPLETED';
        order.refundId = resource.id;
        order.refundedAmount = Math.round(Number(resource.amount?.value || 0) * 100);
        order.addEvent('REFUND_COMPLETED', `Refund ${resource.id} completed via webhook`);
        await order.save();
      }
      return;
    }

    case 'CHECKOUT.ORDER.APPROVED': {
      const order = await Order.findOne({ paypalOrderId: resource.id });
      if (order && order.paymentStatus === PAYMENT_STATUS.CREATED) {
        order.paymentStatus = PAYMENT_STATUS.PENDING;
        order.addEvent('ORDER_APPROVED', 'Buyer approved the order (webhook)');
        await order.save();
      }
      return;
    }

    default:
      logger.debug(`Unhandled webhook event type: ${type}`);
  }
}

export default { handleWebhook };
