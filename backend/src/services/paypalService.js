import paypalConfig from '../config/paypal.js';
import { logger } from '../utils/logger.js';
import { AppError, badGateway } from '../utils/AppError.js';

/**
 * PayPal REST service.
 *
 * - OAuth 2.0 client-credentials token, cached until shortly before expiry.
 * - The client secret is used ONLY here, server-side.
 * - Sandbox vs live base URL comes from paypalConfig.apiBase (env-driven).
 */

let cachedToken = null; // { value, expiresAt }

/**
 * Get (and cache) an OAuth 2.0 access token.
 * POST /v1/oauth2/token  with HTTP Basic auth (clientId:clientSecret).
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(
    `${paypalConfig.clientId}:${paypalConfig.clientSecret}`,
  ).toString('base64');

  const res = await fetch(`${paypalConfig.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error('PayPal OAuth token request failed', res.status, body);
    throw badGateway(
      'Failed to authenticate with PayPal. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET and PAYPAL_MODE.',
      'PAYPAL_AUTH_FAILED',
      body,
    );
  }

  cachedToken = {
    value: body.access_token,
    expiresAt: now + (body.expires_in ? body.expires_in * 1000 : 3_000_000),
  };
  logger.debug('Obtained new PayPal access token');
  return cachedToken.value;
}

/** Low-level authenticated request helper. */
async function paypalRequest(method, path, { body, headers = {}, requestId } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalConfig.apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    logger.error(`PayPal ${method} ${path} -> ${res.status}`, json);
    const message =
      json?.message ||
      json?.error_description ||
      `PayPal request failed (${res.status})`;
    throw new AppError(message, res.status === 401 ? 502 : 400, 'PAYPAL_API_ERROR', json);
  }

  return json;
}

/**
 * Create a PayPal order.
 * @param {object} p
 * @param {number} p.amount   amount in the smallest currency unit (cents)
 * @param {string} p.currency e.g. 'USD'
 * @param {string} p.referenceId our internal order id
 * @param {string} [p.requestId] idempotency key (PayPal-Request-Id)
 */
export async function createPayPalOrder({ amount, currency, referenceId, requestId }) {
  const value = (amount / 100).toFixed(2); // cents -> decimal string

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: String(referenceId),
        custom_id: String(referenceId),
        amount: { currency_code: currency, value },
      },
    ],
    application_context: {
      brand_name: 'Teamily Course Store',
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
    },
  };

  return paypalRequest('POST', '/v2/checkout/orders', { body: payload, requestId });
}

/** Capture a PayPal order (server-side). */
export async function capturePayPalOrder(paypalOrderId, requestId) {
  return paypalRequest('POST', `/v2/checkout/orders/${paypalOrderId}/capture`, {
    body: {},
    requestId,
  });
}

/** Fetch a PayPal order (used to verify state before/after capture). */
export async function getPayPalOrder(paypalOrderId) {
  return paypalRequest('GET', `/v2/checkout/orders/${paypalOrderId}`);
}

/**
 * Refund a captured payment.
 * @param {string} captureId the PayPal capture id
 * @param {number} [amount]  partial refund amount in cents (omit for full refund)
 * @param {string} [currency]
 */
export async function refundCapture(captureId, amount, currency = 'USD', requestId) {
  const body = {};
  if (typeof amount === 'number') {
    body.amount = { value: (amount / 100).toFixed(2), currency_code: currency };
  }
  return paypalRequest('POST', `/v2/payments/captures/${captureId}/refund`, {
    body,
    requestId,
  });
}

/**
 * Verify a webhook signature with PayPal.
 * POST /v1/notifications/verify-webhook-signature
 * Returns true only when verification_status === 'SUCCESS'.
 */
export async function verifyWebhookSignature(headers, rawBodyString) {
  if (!paypalConfig.webhookId) {
    logger.warn('PAYPAL_WEBHOOK_ID is not set — skipping signature verification (development only).');
    return { verified: false, skipped: true };
  }

  const payload = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: paypalConfig.webhookId,
    webhook_event: JSON.parse(rawBodyString),
  };

  const result = await paypalRequest(
    'POST',
    '/v1/notifications/verify-webhook-signature',
    { body: payload },
  );

  return { verified: result?.verification_status === 'SUCCESS', raw: result };
}

export default {
  getAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
  refundCapture,
  verifyWebhookSignature,
};
