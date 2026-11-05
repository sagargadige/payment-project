import { Router } from 'express';
import express from 'express';
import { handleWebhook } from '../controllers/webhookController.js';

const router = Router();

/**
 * PayPal webhooks MUST be verified against the raw request body, so this route
 * uses express.raw() instead of the global express.json() parser.
 */
router.post('/', express.raw({ type: '*/*' }), handleWebhook);

export default router;
