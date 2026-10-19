import cron from 'node-cron';

import env from '../config/env.js';
import Contest from '../models/Contest.js';
import { pruneOldContests, syncContests } from '../services/contest.service.js';
import logger from '../utils/logger.js';

export const JOB_NAME = 'contest-sync';

let running = false;

const runOnce = async (trigger) => {
  if (running) {
    logger.warn('Contest sync already running - skipping tick', { trigger });
    return null;
  }

  running = true;
  try {
    const results = await syncContests();

    // Keep the cache from growing without bound; history stays for 60 days.
    const pruned = await pruneOldContests({ olderThanDays: 60 }).catch(() => 0);

    logger.info('Contest sync finished', { trigger, results, pruned });
    return results;
  } catch (error) {
    logger.error('Contest sync crashed', { trigger, error: error.message });
    return null;
  } finally {
    running = false;
  }
};

export const register = async () => {
  const task = cron.schedule(env.CONTEST_SYNC_CRON, () => runOnce('cron'), { timezone: 'UTC' });

  // The calendar is the most visible "is this thing live?" surface, so make
  // sure it has data as soon as the server boots.
  Contest.estimatedDocumentCount()
    .then((count) => (count === 0 ? runOnce('bootstrap') : null))
    .catch((error) => logger.warn('Could not check contest count', { error: error.message }));

  return task;
};

export default register;
