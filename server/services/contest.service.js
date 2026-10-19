import { PLATFORMS, SOURCES } from '../config/constants.js';
import Contest from '../models/Contest.js';
import cache from '../utils/cache.js';
import logger from '../utils/logger.js';
import { getSourceStatus } from './sourceHealth.service.js';
import * as clist from './sources/clist.service.js';
import * as codeforces from './sources/codeforces.service.js';

/**
 * Unified contest calendar.
 *
 * The `contests` collection IS the snapshot layer here: reads always come from
 * MongoDB, so the calendar keeps working when Codeforces or clist.by is down.
 * Freshness is reported honestly instead of being faked.
 */

/** Anything cached longer than this is reported as stale to the client. */
const FRESH_WINDOW_MS = 60 * 60 * 1000;

const phaseFor = (startTime, endTime, now = Date.now()) => {
  if (now < startTime.getTime()) return 'before';
  if (now <= endTime.getTime()) return 'coding';
  return 'finished';
};

/* ------------------------------------------------------------------- sync */

const codeforcesRows = async () => {
  const contests = await codeforces.fetchContestList({ gym: false });

  return contests
    .filter((contest) => contest.phase === 'BEFORE' || contest.phase === 'CODING')
    .map((contest) => {
      const startTime = new Date((contest.startTimeSeconds ?? 0) * 1000);

      return {
        platform: PLATFORMS.CODEFORCES,
        externalId: String(contest.id),
        name: contest.name,
        url: `https://codeforces.com/contest/${contest.id}`,
        startTime,
        endTime: new Date(startTime.getTime() + (contest.durationSeconds ?? 0) * 1000),
        durationSeconds: contest.durationSeconds ?? 0,
        division: codeforces.parseDivision(contest.name),
        source: SOURCES.CODEFORCES_CONTESTS,
      };
    })
    // A contest with no scheduled start is useless on a calendar.
    .filter((row) => row.startTime.getTime() > 0);
};

const upsertContests = async (rows) => {
  if (rows.length === 0) return { upserted: 0, modified: 0 };

  const operations = rows.map((row) => ({
    updateOne: {
      filter: { platform: row.platform, externalId: row.externalId },
      update: {
        $set: {
          ...row,
          phase: phaseFor(row.startTime, row.endTime),
          fetchedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await Contest.bulkWrite(operations, { ordered: false });
  return { upserted: result.upsertedCount ?? 0, modified: result.modifiedCount ?? 0 };
};

/**
 * Refresh every configured source. Sources are independent: Codeforces still
 * updates when clist.by is unavailable, and vice versa.
 */
export const syncContests = async () => {
  const tasks = [{ name: 'codeforces', run: codeforcesRows }];

  if (clist.isEnabled()) {
    tasks.push({ name: 'clist', run: () => clist.fetchUpcomingContests() });
  }

  const settled = await Promise.allSettled(tasks.map((task) => task.run()));
  const results = [];

  for (const [index, outcome] of settled.entries()) {
    const name = tasks[index].name;

    if (outcome.status === 'fulfilled') {
      const written = await upsertContests(outcome.value);
      results.push({ source: name, ok: true, fetched: outcome.value.length, ...written });
    } else {
      logger.warn('Contest source failed', { source: name, error: outcome.reason?.message });
      results.push({ source: name, ok: false, error: outcome.reason?.message });
    }
  }

  if (!clist.isEnabled()) {
    results.push({
      source: 'clist',
      ok: false,
      skipped: true,
      error: 'clist.by is not configured, so LeetCode and CodeChef contests come from cache only.',
    });
  }

  cache.invalidatePrefix('contests:');
  return results;
};

/* -------------------------------------------------------------------- read */

/**
 * @param {{
 *   platforms?: string[], status?: 'upcoming'|'running'|'past'|'all',
 *   from?: Date, to?: Date, minDurationHours?: number, maxDurationHours?: number,
 *   limit?: number,
 * }} params
 */
export const listContests = async (params = {}) => {
  const {
    platforms = [],
    status = 'upcoming',
    from,
    to,
    minDurationHours,
    maxDurationHours,
    limit = 200,
  } = params;

  const now = new Date();
  const filter = {};

  if (platforms.length > 0) filter.platform = { $in: platforms };

  if (status === 'upcoming') filter.startTime = { $gte: now };
  else if (status === 'running') {
    filter.startTime = { $lte: now };
    filter.endTime = { $gte: now };
  } else if (status === 'past') filter.endTime = { $lt: now };

  // An explicit range (calendar month view) overrides the status shortcut.
  if (from || to) {
    filter.startTime = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
    delete filter.endTime;
  }

  if (Number.isFinite(minDurationHours) || Number.isFinite(maxDurationHours)) {
    filter.durationSeconds = {
      ...(Number.isFinite(minDurationHours) ? { $gte: minDurationHours * 3600 } : {}),
      ...(Number.isFinite(maxDurationHours) ? { $lte: maxDurationHours * 3600 } : {}),
    };
  }

  const rows = await Contest.find(filter)
    .sort({ startTime: status === 'past' ? -1 : 1 })
    .limit(limit)
    .lean();

  const items = rows.map((row) => ({
    id: String(row._id),
    platform: row.platform,
    externalId: row.externalId,
    name: row.name,
    url: row.url,
    startTime: row.startTime,
    endTime: row.endTime,
    durationSeconds: row.durationSeconds,
    division: row.division ?? null,
    // Recomputed on read: a stored phase goes stale within minutes.
    phase: phaseFor(row.startTime, row.endTime, now.getTime()),
    source: row.source,
    fetchedAt: row.fetchedAt,
  }));

  const newestFetch = rows.reduce(
    (latest, row) => Math.max(latest, new Date(row.fetchedAt ?? 0).getTime()),
    0,
  );

  const sourceStatuses = {
    codeforces: getSourceStatus(SOURCES.CODEFORCES_CONTESTS),
    clist: clist.isEnabled()
      ? getSourceStatus(SOURCES.CLIST_CONTESTS)
      : { status: 'not-configured', lastSuccessAt: null },
  };

  const isStale = newestFetch === 0 || Date.now() - newestFetch > FRESH_WINDOW_MS;

  return {
    items,
    stale: isStale,
    fetchedAt: newestFetch ? new Date(newestFetch) : null,
    source: 'mongodb-cache',
    sources: sourceStatuses,
    counts: {
      total: items.length,
      byPlatform: items.reduce((accumulator, item) => {
        accumulator[item.platform] = (accumulator[item.platform] ?? 0) + 1;
        return accumulator;
      }, {}),
    },
    clistConfigured: clist.isEnabled(),
  };
};

export const getContestById = async (id) => {
  const contest = await Contest.findById(id).lean();
  if (!contest) return null;

  return {
    ...contest,
    id: String(contest._id),
    phase: phaseFor(contest.startTime, contest.endTime),
  };
};

/** Remove contests that finished long ago so the cache does not grow forever. */
export const pruneOldContests = async ({ olderThanDays = 60 } = {}) => {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const result = await Contest.deleteMany({ endTime: { $lt: cutoff } });
  return result.deletedCount ?? 0;
};

export default { syncContests, listContests, getContestById };
