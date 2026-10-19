import { SOURCES } from '../config/constants.js';
import { isDatabaseConnected } from '../config/db.js';
import SourceHealth from '../models/SourceHealth.js';
import logger from '../utils/logger.js';

/**
 * Health ledger for every third-party source.
 *
 * Deliberately in-memory first: /api/health must answer even when Mongo is
 * unreachable. Writes to Mongo are best-effort so the data survives restarts.
 */

const memory = new Map();

const blank = (source) => ({
  source,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: '',
  lastLatencyMs: null,
  consecutiveFailures: 0,
  totalSuccesses: 0,
  totalFailures: 0,
});

const entry = (source) => {
  if (!memory.has(source)) memory.set(source, blank(source));
  return memory.get(source);
};

/** In-flight writes, so short-lived scripts can wait for them before disconnecting. */
const pendingWrites = new Set();

const persist = (source, update) => {
  if (!isDatabaseConnected()) return;

  const write = SourceHealth.updateOne(
    { source },
    { $set: { source, ...update } },
    { upsert: true },
  )
    .catch((error) =>
      logger.debug('Source health persist failed', { source, error: error.message }),
    )
    .finally(() => pendingWrites.delete(write));

  pendingWrites.add(write);
};

/** Resolves once every queued health write has settled (used by CLI scripts). */
export const flushHealthWrites = () => Promise.allSettled([...pendingWrites]);

export const recordSuccess = (source, { latencyMs = null } = {}) => {
  const current = entry(source);
  current.lastSuccessAt = new Date();
  current.lastLatencyMs = latencyMs;
  current.consecutiveFailures = 0;
  current.totalSuccesses += 1;

  persist(source, {
    lastSuccessAt: current.lastSuccessAt,
    lastLatencyMs: latencyMs,
    consecutiveFailures: 0,
    totalSuccesses: current.totalSuccesses,
  });

  return current;
};

export const recordFailure = (source, error) => {
  const current = entry(source);
  current.lastErrorAt = new Date();
  current.lastError = String(error?.message ?? error ?? 'unknown error').slice(0, 300);
  current.consecutiveFailures += 1;
  current.totalFailures += 1;

  persist(source, {
    lastErrorAt: current.lastErrorAt,
    lastError: current.lastError,
    consecutiveFailures: current.consecutiveFailures,
    totalFailures: current.totalFailures,
  });

  return current;
};

/** Load persisted counters at boot so health survives a redeploy. */
export const hydrateFromDatabase = async () => {
  if (!isDatabaseConnected()) return 0;

  try {
    const rows = await SourceHealth.find().lean();
    for (const row of rows) {
      memory.set(row.source, {
        source: row.source,
        lastSuccessAt: row.lastSuccessAt ?? null,
        lastErrorAt: row.lastErrorAt ?? null,
        lastError: row.lastError ?? '',
        lastLatencyMs: row.lastLatencyMs ?? null,
        consecutiveFailures: row.consecutiveFailures ?? 0,
        totalSuccesses: row.totalSuccesses ?? 0,
        totalFailures: row.totalFailures ?? 0,
      });
    }
    return rows.length;
  } catch (error) {
    logger.debug('Source health hydrate failed', { error: error.message });
    return 0;
  }
};

const statusFor = (record) => {
  if (!record.lastSuccessAt && !record.lastErrorAt) return 'unknown';
  if (record.consecutiveFailures === 0) return 'ok';
  if (record.lastSuccessAt) return 'degraded';
  return 'down';
};

/** Snapshot of every known source, ordered by name. */
export const getHealthReport = () => {
  const known = new Set([...Object.values(SOURCES), ...memory.keys()]);

  return [...known].sort().map((source) => {
    const record = memory.get(source) ?? blank(source);
    return {
      source,
      status: statusFor(record),
      lastSuccessAt: record.lastSuccessAt,
      lastErrorAt: record.lastErrorAt,
      lastError: record.lastError || undefined,
      lastLatencyMs: record.lastLatencyMs,
      consecutiveFailures: record.consecutiveFailures,
      totalSuccesses: record.totalSuccesses,
      totalFailures: record.totalFailures,
    };
  });
};

export const getSourceStatus = (source) => {
  const record = memory.get(source) ?? blank(source);
  return { ...record, status: statusFor(record) };
};

/** Test helper. */
export const __reset = () => memory.clear();

export default { recordSuccess, recordFailure, getHealthReport, getSourceStatus };
