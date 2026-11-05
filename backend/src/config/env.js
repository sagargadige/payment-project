import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env regardless of the current working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['MONGODB_URI', 'JWT_SECRET', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'];

const missing = required.filter((key) => !process.env[key] || process.env[key].startsWith('YOUR_'));

if (missing.length > 0) {
  // Fail fast with a helpful message instead of crashing later with a cryptic error.
  console.error('\n[config] Missing or placeholder environment variables:');
  missing.forEach((k) => console.error(`   - ${k}`));
  console.error('\nCopy backend/.env.example to backend/.env and fill in your own values.');
  console.error('See README.md -> "Configure your credentials".\n');
  process.exit(1);
}

const paypalMode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT || 5000),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  mongoUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  paypal: {
    mode: paypalMode,
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    receivingAccount: process.env.PAYPAL_RECEIVING_ACCOUNT || '',
    // Sandbox and live endpoints are separated here — the ONLY place the base URL is chosen.
    apiBase:
      paypalMode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com',
  },
};

export default env;
