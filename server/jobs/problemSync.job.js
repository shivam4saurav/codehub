import cron from 'node-cron';

import env from '../config/env.js';
import Problem from '../models/Problem.js';
import { syncAllProblems } from '../services/problemSync.service.js';
import logger from '../utils/logger.js';

export const JOB_NAME = 'problem-sync';

let running = false;

/** Guard against overlap: a slow sync must not be started twice. */
const runOnce = async (trigger) => {
  if (running) {
    logger.warn('Problem sync already running - skipping this tick', { trigger });
    return null;
  }

  running = true;
  try {
    const results = await syncAllProblems();
    logger.info('Problem sync finished', { trigger, results });
    return results;
  } catch (error) {
    logger.error('Problem sync crashed', { trigger, error: error.message });
    return null;
  } finally {
    running = false;
  }
};

export const register = async () => {
  const task = cron.schedule(env.PROBLEM_SYNC_CRON, () => runOnce('cron'), {
    timezone: 'UTC',
  });

  // Cold start: if the collection is empty the browser would show nothing, so
  // seed it in the background instead of waiting hours for the first tick.
  Problem.estimatedDocumentCount()
    .then((count) => {
      if (count === 0) {
        logger.info('Problem collection empty - running initial sync');
        return runOnce('bootstrap');
      }
      logger.info('Problem collection ready', { count });
      return null;
    })
    .catch((error) => logger.warn('Could not check problem count', { error: error.message }));

  return task;
};

export default register;
