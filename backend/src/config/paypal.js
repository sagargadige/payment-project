import env from './env.js';

/**
 * Central PayPal configuration.
 *
 * The client secret lives ONLY here (read from backend/.env) and is never
 * exposed to the frontend. Sandbox vs live is decided by PAYPAL_MODE.
 */
export const paypalConfig = {
  mode: env.paypal.mode,
  clientId: env.paypal.clientId,
  clientSecret: env.paypal.clientSecret,
  webhookId: env.paypal.webhookId,
  receivingAccount: env.paypal.receivingAccount,
  apiBase: env.paypal.apiBase,
  // Public client id is safe to hand to the browser (used by the JS SDK).
  publicClientId: env.paypal.clientId,
};

export default paypalConfig;
