import ProfileSnapshot from '../models/ProfileSnapshot.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import * as defaultHealth from './sourceHealth.service.js';

/**
 * Stale-while-error core
 * ---------------------------------------------------------------------------
 * LeetCode and CodeChef have no official API and WILL fail at some point -
 * possibly mid-demo. Every read of third-party data therefore goes through
 * `fetchWithFallback`:
 *
 *   1. run the live fetcher
 *   2. validate the response SHAPE before trusting it
 *   3. on success  -> persist a snapshot, return { stale: false }
 *   4. on failure  -> return the last good snapshot as { stale: true }
 *   5. only if there is no snapshot at all does the caller get an error
 *
 * Because validation happens before the write, a broken/changed upstream
 * response can never overwrite good data.
 */

export class ShapeValidationError extends Error {
  constructor(message = 'Unexpected response shape from source') {
    super(message);
    this.name = 'ShapeValidationError';
    this.isShapeError = true;
  }
}

/**
 * Mongo-backed store for one KIND of payload (profile stats, submission
 * activity, ...). Each kind gets its own row per handle, so a profile refresh
 * never clobbers cached submission history.
 */
export const createProfileSnapshotStore = ({ model = ProfileSnapshot, kind = 'profile' } = {}) => ({
  async read({ platform, handle }) {
    const normalizedHandle = String(handle).trim().toLowerCase();
    const found = await model.findOne({ platform, normalizedHandle, kind }).lean();
    if (!found) return null;

    return {
      payload: found.payload,
      fetchedAt: found.fetchedAt,
      source: found.source,
    };
  },

  async write({ platform, handle, payload, source }) {
    const normalizedHandle = String(handle).trim().toLowerCase();

    await model.updateOne(
      { platform, normalizedHandle, kind },
      {
        $set: {
          platform,
          handle: String(handle).trim(),
          normalizedHandle,
          kind,
          payload,
          source,
          fetchedAt: new Date(),
        },
      },
      { upsert: true },
    );
  },

  async markServedStale({ platform, handle }) {
    const normalizedHandle = String(handle).trim().toLowerCase();
    await model
      .updateOne({ platform, normalizedHandle, kind }, { $inc: { servedStaleCount: 1 } })
      .catch(() => {});
  },
});

/**
 * @template T
 * @param {{
 *   platform: string,
 *   handle?: string,
 *   source: string,
 *   fetcher: () => Promise<T>,
 *   validate?: (value: T) => boolean,
 *   store?: {
 *     read: (key: object) => Promise<{payload: T, fetchedAt: Date, source: string}|null>,
 *     write: (input: object) => Promise<void>,
 *     markServedStale?: (key: object) => Promise<void>,
 *   },
 *   health?: { recordSuccess: Function, recordFailure: Function },
 *   allowEmptySnapshot?: boolean,
 *   notFoundMessage?: string,
 * }} options
 * @returns {Promise<{data: T, stale: boolean, fetchedAt: Date, source: string, staleReason?: string}>}
 */
export const fetchWithFallback = async ({
  platform,
  handle = '',
  source,
  fetcher,
  validate,
  store,
  health = defaultHealth,
  notFoundMessage,
}) => {
  const snapshotStore = store ?? createProfileSnapshotStore();
  const key = { platform, handle };
  const startedAt = Date.now();

  try {
    const live = await fetcher();

    if (validate && !validate(live)) {
      throw new ShapeValidationError(`${source} returned an unexpected shape`);
    }

    health.recordSuccess(source, { latencyMs: Date.now() - startedAt });

    // Persisting must never break the request that just succeeded.
    try {
      await snapshotStore.write({ platform, handle, payload: live, source });
    } catch (error) {
      logger.warn('Snapshot write failed', { source, platform, handle, error: error.message });
    }

    return { data: live, stale: false, fetchedAt: new Date(), source };
  } catch (error) {
    // A confirmed "this handle does not exist" is a real 404, not an outage:
    // serving a stale snapshot for a typo'd handle would be misleading.
    if (error instanceof ApiError && error.statusCode === 404) throw error;

    health.recordFailure(source, error);
    logger.warn('Live fetch failed, trying snapshot', {
      source,
      platform,
      handle,
      reason: error.message,
    });

    let snapshot = null;
    try {
      snapshot = await snapshotStore.read(key);
    } catch (readError) {
      logger.error('Snapshot read failed', { source, error: readError.message });
    }

    if (snapshot) {
      snapshotStore.markServedStale?.(key)?.catch?.(() => {});

      return {
        data: snapshot.payload,
        stale: true,
        fetchedAt: snapshot.fetchedAt,
        source: snapshot.source ?? source,
        staleReason: error.isShapeError ? 'source-shape-changed' : 'source-unavailable',
      };
    }

    throw ApiError.serviceUnavailable(
      notFoundMessage ??
        `${source} is unavailable right now and no cached copy exists yet. Try again shortly.`,
      { code: 'SOURCE_UNAVAILABLE', cause: error },
    );
  }
};

/**
 * Run several fallback-backed fetches independently: one platform being down
 * must never blank out the others.
 *
 * @param {Record<string, () => Promise<any>>} tasks
 * @returns {Promise<{results: Record<string, any>, statuses: Record<string, object>}>}
 */
export const settleAll = async (tasks) => {
  const names = Object.keys(tasks);
  const settled = await Promise.allSettled(names.map((name) => tasks[name]()));

  const results = {};
  const statuses = {};

  names.forEach((name, index) => {
    const outcome = settled[index];

    if (outcome.status === 'fulfilled') {
      const value = outcome.value;
      results[name] = value?.data ?? value ?? null;
      statuses[name] = {
        ok: true,
        stale: Boolean(value?.stale),
        fetchedAt: value?.fetchedAt ?? null,
        source: value?.source ?? null,
        staleReason: value?.staleReason,
      };
    } else {
      const error = outcome.reason;
      results[name] = null;
      statuses[name] = {
        ok: false,
        stale: false,
        fetchedAt: null,
        error: error?.message ?? 'Unknown error',
        code: error?.code ?? error?.statusCode ?? undefined,
      };
    }
  });

  return { results, statuses };
};

/** Standard envelope so every third-party-backed endpoint looks the same. */
export const envelope = ({ data, stale = false, fetchedAt = new Date(), source, ...rest }) => ({
  data,
  stale,
  fetchedAt,
  source,
  ...rest,
});

export default fetchWithFallback;
