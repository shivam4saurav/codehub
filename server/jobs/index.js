import logger from '../utils/logger.js';

/**
 * Background job registry.
 *
 * Each job module exports `register()` returning a node-cron task. Jobs are
 * started once from server.js and stopped on shutdown so a redeploy never
 * leaves a scheduler running against a closed database connection.
 */
const JOB_MODULES = [
  './problemSync.job.js',
  './contestSync.job.js',
  './reminders.job.js',
];

export const startJobs = async () => {
  const tasks = [];

  for (const modulePath of JOB_MODULES) {
    try {
      const module = await import(modulePath);
      const task = await module.register?.();
      if (task) {
        tasks.push({ name: module.JOB_NAME ?? modulePath, task });
        logger.info('Job scheduled', { job: module.JOB_NAME ?? modulePath });
      }
    } catch (error) {
      // A single broken job must not stop the others (or the API).
      logger.error('Failed to schedule job', { job: modulePath, error: error.message });
    }
  }

  return {
    tasks,
    stopAll() {
      for (const { name, task } of tasks) {
        try {
          task.stop();
          logger.info('Job stopped', { job: name });
        } catch (error) {
          logger.warn('Job stop failed', { job: name, error: error.message });
        }
      }
    },
  };
};

export default startJobs;
