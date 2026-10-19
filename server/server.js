import createApp from './app.js';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { hydrateFromDatabase } from './services/sourceHealth.service.js';
import logger from './utils/logger.js';

const start = async () => {
  try {
    await connectDatabase();
    await hydrateFromDatabase();
  } catch (error) {
    logger.error('Could not connect to MongoDB - exiting', { error: error.message });
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`CodeHub API listening on http://localhost:${env.PORT}`, {
      env: env.NODE_ENV,
      client: env.CLIENT_URL,
    });
  });

  let jobs = null;
  if (env.ENABLE_CRON) {
    try {
      const { startJobs } = await import('./jobs/index.js');
      jobs = await startJobs();
    } catch (error) {
      logger.error('Background jobs failed to start', { error: error.message });
    }
  } else {
    logger.warn('Cron jobs disabled (ENABLE_CRON=false)');
  }

  const shutdown = async (signal) => {
    logger.info(`${signal} received - shutting down`);

    server.close(async () => {
      try {
        jobs?.stopAll?.();
        await disconnectDatabase();
      } finally {
        process.exit(0);
      }
    });

    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: reason?.message ?? String(reason) });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception - shutting down', { error: error.message, stack: error.stack });
    shutdown('uncaughtException');
  });
};

start();
