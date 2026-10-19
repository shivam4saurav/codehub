import logger from './logger.js';
import { sleep } from './requestQueue.js';

/** Retry only on transient failures: network errors, timeouts, 429 and 5xx. */
export const isTransientError = (error) => {
  if (!error) return false;

  const status = error.response?.status ?? error.statusCode;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  if (typeof status === 'number') return false;

  const transientCodes = new Set([
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EAI_AGAIN',
    'ENOTFOUND',
    'EPIPE',
    'ETIMEDOUT',
    'ERR_NETWORK',
    'ERR_CANCELED',
  ]);

  return transientCodes.has(error.code);
};

/**
 * Exponential backoff with jitter.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{
 *   retries?: number,
 *   baseDelayMs?: number,
 *   maxDelayMs?: number,
 *   label?: string,
 *   shouldRetry?: (error: unknown) => boolean,
 * }} [options]
 * @returns {Promise<T>}
 */
export const withRetry = async (fn, options = {}) => {
  const {
    retries = 2,
    baseDelayMs = 400,
    maxDelayMs = 4000,
    label = 'request',
    shouldRetry = isTransientError,
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === retries || !shouldRetry(error)) break;

      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delay = Math.round(backoff * (0.7 + Math.random() * 0.6));

      logger.warn(`${label} failed, retrying`, {
        attempt: attempt + 1,
        of: retries,
        delayMs: delay,
        reason: error?.message,
      });

      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError;
};

export default withRetry;
