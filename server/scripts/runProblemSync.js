/**
 * One-off problem sync: `npm run sync:problems --workspace=server`
 * Useful right after setting up the database, or before a demo.
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { syncAllProblems } from '../services/problemSync.service.js';
import { flushHealthWrites } from '../services/sourceHealth.service.js';
import logger from '../utils/logger.js';

const run = async () => {
  await connectDatabase();

  const results = await syncAllProblems();
  for (const result of results) {
    if (result.ok) {
      logger.info(`${result.platform}: ${result.upserted} new, ${result.modified} updated`);
      if (result.unmappedTags?.length) {
        logger.warn(`${result.platform} unmapped tags: ${result.unmappedTags.join(', ')}`);
      }
    } else {
      logger.error(`${result.platform} failed: ${result.error}`);
    }
  }

  // Health updates are fire-and-forget; let them land before the connection closes.
  await flushHealthWrites();
  await disconnectDatabase();
  process.exit(results.some((result) => result.ok) ? 0 : 1);
};

run().catch(async (error) => {
  logger.error('Sync script failed', { error: error.message });
  await disconnectDatabase();
  process.exit(1);
});
