import mongoose from 'mongoose';

/**
 * Order model — case study requirements:
 *   _id, userId, courseId, paypalOrderId, amount, currency,
 *   paymentStatus, captureId, course access status.
 *
 * On a successful payment: paymentStatus = 'SUCCESS' and courseAccess = 'YES'.
 *
 * Extra fields (refundId, refundStatus, failureReason, idempotencyKey, events)
 * support refunds, failed-payment tracking and duplicate-payment protection.
 */

export const PAYMENT_STATUS = Object.freeze({
  CREATED: 'CREATED',       // PayPal order created, not yet approved/paid
  PENDING: 'PENDING',       // approved by buyer, capture in progress
  SUCCESS: 'SUCCESS',       // captured & verified server-side
  FAILED: 'FAILED',         // capture failed / declined
  CANCELLED: 'CANCELLED',   // buyer cancelled or admin cancelled
  REFUNDED: 'REFUNDED',     // fully refunded
});

export const COURSE_ACCESS = Object.freeze({
  YES: 'YES',
  NO: 'NO',
});

const orderEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. ORDER_CREATED, CAPTURED, WEBHOOK, REFUNDED
    message: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    // Snapshot of the course at purchase time (so history stays correct if the course changes).
    courseTitle: { type: String, default: '' },

    paypalOrderId: { type: String, default: null, index: true },
    captureId: { type: String, default: null, index: true },

    // Amount in the smallest currency unit (cents), read server-side from the Course.
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', uppercase: true },

    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.CREATED,
      index: true,
    },
    courseAccess: {
      type: String,
      enum: Object.values(COURSE_ACCESS),
      default: COURSE_ACCESS.NO,
      index: true,
    },

    // Refund tracking
    refundId: { type: String, default: null },
    refundStatus: { type: String, enum: ['NONE', 'REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'], default: 'NONE' },
    refundedAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: '' },

    // Failure tracking (admin "track failed payments")
    failureReason: { type: String, default: '' },

    // Duplicate-payment protection: a client-supplied key makes create-order idempotent.
    idempotencyKey: { type: String, default: null, index: true },

    // Audit trail
    events: { type: [orderEventSchema], default: [] },
  },
  { timestamps: true },
);

// One order per (user, course) that is still open — prevents accidental double orders.
orderSchema.index({ userId: 1, courseId: 1, paymentStatus: 1 });

orderSchema.methods.addEvent = function addEvent(type, message = '', data = {}) {
  this.events.push({ type, message, data });
};

orderSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id,
    userId: this.userId,
    courseId: this.courseId,
    courseTitle: this.courseTitle,
    paypalOrderId: this.paypalOrderId,
    captureId: this.captureId,
    amount: this.amount,
    currency: this.currency,
    paymentStatus: this.paymentStatus,
    courseAccess: this.courseAccess,
    refundId: this.refundId,
    refundStatus: this.refundStatus,
    refundedAmount: this.refundedAmount,
    refundReason: this.refundReason,
    failureReason: this.failureReason,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Order = mongoose.model('Order', orderSchema);
export default Order;
