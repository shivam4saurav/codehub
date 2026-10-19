/**
 * One-off contest sync: `npm run sync:contests --workspace=server`
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { syncContests } from '../services/contest.service.js';
import { flushHealthWrites } from '../services/sourceHealth.service.js';
import logger from '../utils/logger.js';

const run = async () => {
  await connectDatabase();

  const results = await syncContests();
  for (const result of results) {
    if (result.ok) {
      logger.info(`${result.source}: ${result.fetched} fetched, ${result.upserted} new`);
    } else if (result.skipped) {
      logger.warn(`${result.source}: skipped - ${result.error}`);
    } else {
      logger.error(`${result.source} failed: ${result.error}`);
    }
  }

  // Health updates are fire-and-forget; let them land before the connection closes.
  await flushHealthWrites();
  await disconnectDatabase();
  process.exit(results.some((result) => result.ok) ? 0 : 1);
};

run().catch(async (error) => {
  logger.error('Contest sync script failed', { error: error.message });
  await disconnectDatabase();
  process.exit(1);
});
