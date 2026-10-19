import env from '../config/env.js';
import { databaseStatus, isDatabaseConnected } from '../config/db.js';
import { getHealthReport } from '../services/sourceHealth.service.js';
import cache from '../utils/cache.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/health
 * Reports the API, the database and the last successful fetch per third-party
 * source. Intentionally does not require the database, so it still answers
 * during an outage.
 */
export const health = asyncHandler(async (_req, res) => {
  const sources = getHealthReport();
  const anyDown = sources.some((source) => source.status === 'down');

  res.json({
    status: isDatabaseConnected() ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: { status: databaseStatus(), connected: isDatabaseConnected() },
    integrations: {
      clist: env.clistEnabled ? 'configured' : 'not-configured',
      smtp: env.smtpEnabled ? 'configured' : 'console-fallback',
    },
    cache: cache.stats(),
    sources,
    degraded: anyDown || !isDatabaseConnected(),
  });
});

export default health;
