import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { fetchWithFallback, settleAll } from '../../services/snapshot.service.js';
import ApiError from '../../utils/ApiError.js';

/** Minimal in-memory implementation of the snapshot store contract. */
const createMemoryStore = (seed = null) => {
  let snapshot = seed;

  return {
    writes: 0,
    staleServes: 0,
    async read() {
      return snapshot;
    },
    async write({ payload, source }) {
      this.writes += 1;
      snapshot = { payload, source, fetchedAt: new Date() };
    },
    async markServedStale() {
      this.staleServes += 1;
    },
    current: () => snapshot,
  };
};

const createHealthSpy = () => ({
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
});

const validProfile = { handle: 'tourist', rating: 3800 };
const isProfile = (value) => Boolean(value && typeof value.handle === 'string');

describe('snapshot fallback: happy path', () => {
  let store;
  let health;

  beforeEach(() => {
    store = createMemoryStore();
    health = createHealthSpy();
  });

  it('returns live data and persists a snapshot', async () => {
    const result = await fetchWithFallback({
      platform: 'codeforces',
      handle: 'tourist',
      source: 'codeforces:profile',
      fetcher: async () => validProfile,
      validate: isProfile,
      store,
      health,
    });

    expect(result.data).toEqual(validProfile);
    expect(result.stale).toBe(false);
    expect(store.writes).toBe(1);
    expect(health.recordSuccess).toHaveBeenCalledTimes(1);
    expect(health.recordFailure).not.toHaveBeenCalled();
  });

  it('still returns data when persisting the snapshot fails', async () => {
    const brokenStore = {
      ...createMemoryStore(),
      write: async () => {
        throw new Error('mongo down');
      },
    };

    const result = await fetchWithFallback({
      platform: 'codeforces',
      handle: 'tourist',
      source: 'codeforces:profile',
      fetcher: async () => validProfile,
      validate: isProfile,
      store: brokenStore,
      health,
    });

    expect(result.stale).toBe(false);
    expect(result.data).toEqual(validProfile);
  });
});

describe('snapshot fallback: source failures', () => {
  let health;

  beforeEach(() => {
    health = createHealthSpy();
  });

  it('serves the last good snapshot when the live fetch throws', async () => {
    const fetchedAt = new Date('2026-01-01T10:00:00.000Z');
    const store = createMemoryStore({
      payload: validProfile,
      source: 'codeforces:profile',
      fetchedAt,
    });

    const result = await fetchWithFallback({
      platform: 'codeforces',
      handle: 'tourist',
      source: 'codeforces:profile',
      fetcher: async () => {
        throw new Error('ETIMEDOUT');
      },
      validate: isProfile,
      store,
      health,
    });

    expect(result.stale).toBe(true);
    expect(result.data).toEqual(validProfile);
    expect(result.fetchedAt).toEqual(fetchedAt);
    expect(result.staleReason).toBe('source-unavailable');
    expect(health.recordFailure).toHaveBeenCalledTimes(1);
    expect(store.staleServes).toBe(1);
  });

  it('treats a changed response shape as a failure and keeps the good snapshot', async () => {
    const store = createMemoryStore({
      payload: validProfile,
      source: 'leetcode:profile',
      fetchedAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    const result = await fetchWithFallback({
      platform: 'leetcode',
      handle: 'tourist',
      source: 'leetcode:profile',
      // Upstream changed its payload: no `handle` field any more.
      fetcher: async () => ({ unexpected: true }),
      validate: isProfile,
      store,
      health,
    });

    expect(result.stale).toBe(true);
    expect(result.staleReason).toBe('source-shape-changed');
    expect(result.data).toEqual(validProfile);
    // The invalid payload must NOT have replaced the good snapshot.
    expect(store.current().payload).toEqual(validProfile);
    expect(store.writes).toBe(0);
  });

  it('throws 503 only when there is no snapshot to fall back to', async () => {
    const store = createMemoryStore(null);

    await expect(
      fetchWithFallback({
        platform: 'codechef',
        handle: 'ghost',
        source: 'codechef:profile',
        fetcher: async () => {
          throw new Error('500 from upstream');
        },
        validate: isProfile,
        store,
        health,
      }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'SOURCE_UNAVAILABLE' });
  });

  it('propagates a confirmed 404 instead of masking a typo with stale data', async () => {
    const store = createMemoryStore({
      payload: validProfile,
      source: 'codeforces:profile',
      fetchedAt: new Date(),
    });

    await expect(
      fetchWithFallback({
        platform: 'codeforces',
        handle: 'not-a-real-handle',
        source: 'codeforces:profile',
        fetcher: async () => {
          throw ApiError.notFound('handle not found');
        },
        validate: isProfile,
        store,
        health,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(health.recordFailure).not.toHaveBeenCalled();
  });

  it('survives a snapshot store that cannot be read', async () => {
    const store = {
      read: async () => {
        throw new Error('mongo unreachable');
      },
      write: async () => {},
    };

    await expect(
      fetchWithFallback({
        platform: 'leetcode',
        handle: 'tourist',
        source: 'leetcode:profile',
        fetcher: async () => {
          throw new Error('upstream down');
        },
        validate: isProfile,
        store,
        health,
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('snapshot fallback: one platform down must not break the others', () => {
  it('reports per-platform status through settleAll', async () => {
    const { results, statuses } = await settleAll({
      codeforces: async () => ({
        data: { rating: 1500 },
        stale: false,
        fetchedAt: new Date(),
        source: 'codeforces:profile',
      }),
      leetcode: async () => ({
        data: { solved: 120 },
        stale: true,
        fetchedAt: new Date('2026-01-01T00:00:00.000Z'),
        source: 'leetcode:profile',
        staleReason: 'source-unavailable',
      }),
      codechef: async () => {
        throw ApiError.serviceUnavailable('CodeChef is unreachable');
      },
    });

    expect(results.codeforces).toEqual({ rating: 1500 });
    expect(statuses.codeforces).toMatchObject({ ok: true, stale: false });

    expect(results.leetcode).toEqual({ solved: 120 });
    expect(statuses.leetcode).toMatchObject({ ok: true, stale: true });

    // The failing platform is reported, not thrown.
    expect(results.codechef).toBeNull();
    expect(statuses.codechef).toMatchObject({ ok: false });
    expect(statuses.codechef.error).toMatch(/unreachable/i);
  });
});
