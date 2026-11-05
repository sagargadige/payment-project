import { createApp } from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`Backend listening on http://localhost:${env.port}`);
    logger.info(`PayPal mode: ${env.paypal.mode} (${env.paypal.apiBase})`);
    logger.info(`Receiving account: ${env.paypal.receivingAccount || '(not set)'}`);
    logger.info(`Health: http://localhost:${env.port}/api/health`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if graceful shutdown hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
