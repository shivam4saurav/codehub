import cron from 'node-cron';

import env from '../config/env.js';
import { processDueReminders, requeueStuckClaims } from '../services/reminder.service.js';
import logger from '../utils/logger.js';

export const JOB_NAME = 'reminder-dispatch';

let running = false;
let ticks = 0;

/**
 * Runs every minute. The overlap guard matters here: a slow SMTP server must
 * not cause two ticks to process the same backlog concurrently. Even if it did,
 * the atomic claim in reminder.service makes a double send impossible.
 */
const runOnce = async (trigger) => {
  if (running) return null;

  running = true;
  try {
    ticks += 1;

    // Recovery sweep every 10 minutes, not on every tick.
    if (ticks % 10 === 1) await requeueStuckClaims();

    const summary = await processDueReminders();

    if (summary.claimed > 0) {
      logger.info('Reminder dispatch tick', { trigger, ...summary });
    }

    return summary;
  } catch (error) {
    logger.error('Reminder dispatch crashed', { trigger, error: error.message });
    return null;
  } finally {
    running = false;
  }
};

export const register = async () =>
  cron.schedule(env.REMINDER_CRON, () => runOnce('cron'), { timezone: 'UTC' });

export default register;
