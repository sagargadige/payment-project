import mongoose from 'mongoose';

/**
 * WebhookEvent model — records every PayPal webhook we receive so that
 * processing is idempotent (PayPal retries webhooks; we must not double-process).
 */
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    resourceId: { type: String, default: null },
    verified: { type: Boolean, default: false },
    processed: { type: Boolean, default: false },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export default WebhookEvent;
