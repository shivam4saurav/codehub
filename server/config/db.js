import mongoose from 'mongoose';

import env from './env.js';
import logger from '../utils/logger.js';

mongoose.set('strictQuery', true);

let connectionPromise = null;

export const connectDatabase = async () => {
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      maxPoolSize: 10,
      autoIndex: !env.isProduction,
    })
    .then(async (instance) => {
      logger.info('MongoDB connected', {
        host: instance.connection.host,
        db: instance.connection.name,
      });

      if (env.isProduction) {
        // Indexes are not auto-built in production; do it once at boot so the
        // documented indexes definitely exist on a fresh Atlas cluster.
        await syncIndexes();
      }

      return instance.connection;
    })
    .catch((error) => {
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
};

export const syncIndexes = async () => {
  const results = await Promise.allSettled(
    Object.values(mongoose.models).map(async (model) => {
      await model.syncIndexes();
      return model.modelName;
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.warn('Index sync failed for a model', { reason: result.reason?.message });
    }
  }
};

export const disconnectDatabase = async () => {
  connectionPromise = null;
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;

export const databaseStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
};

mongoose.connection.on('disconnected', () => logger.warn('MongoDB connection lost'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
mongoose.connection.on('error', (error) =>
  logger.error('MongoDB connection error', { error: error.message }),
);

export default connectDatabase;
