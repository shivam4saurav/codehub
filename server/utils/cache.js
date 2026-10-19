import NodeCache from 'node-cache';

import env from '../config/env.js';

/**
 * Process-local TTL cache in front of Mongo and third-party APIs.
 * Durable fallback lives in Mongo (see services/snapshot.service.js) - this is
 * only the fast layer, so losing it on restart is harmless.
 */
const store = new NodeCache({
  stdTTL: env.CACHE_TTL_SECONDS,
  checkperiod: Math.max(30, Math.floor(env.CACHE_TTL_SECONDS / 2)),
  useClones: false,
});

export const cache = {
  get: (key) => store.get(key),
  set: (key, value, ttlSeconds) =>
    ttlSeconds === undefined ? store.set(key, value) : store.set(key, value, ttlSeconds),
  del: (key) => store.del(key),
  /** Drop every key starting with the given prefix. */
  invalidatePrefix(prefix) {
    const keys = store.keys().filter((key) => key.startsWith(prefix));
    if (keys.length > 0) store.del(keys);
    return keys.length;
  },
  flush: () => store.flushAll(),
  stats: () => ({ ...store.getStats(), keys: store.keys().length }),

  /**
   * Cache-aside helper.
   * @template T
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {() => Promise<T>} producer
   * @returns {Promise<T>}
   */
  async wrap(key, ttlSeconds, producer) {
    const hit = store.get(key);
    if (hit !== undefined) return hit;

    const value = await producer();
    if (value !== undefined && value !== null) store.set(key, value, ttlSeconds);
    return value;
  },
};

export default cache;
