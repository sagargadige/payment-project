import mongoose from 'mongoose';
import env from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Connect to MongoDB. Retries a few times so `npm run dev` is resilient when
 * MongoDB is still starting up.
 */
export async function connectDB(retries = 5, delayMs = 2000) {
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 8000,
      });
      logger.info(`MongoDB connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);
      return mongoose.connection;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        logger.error('Could not connect to MongoDB. Is it running? Check MONGODB_URI in backend/.env');
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

export async function disconnectDB() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

export default connectDB;
