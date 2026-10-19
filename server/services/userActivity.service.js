import { CACHE_TTL, PLATFORMS, SOURCES } from '../config/constants.js';
import { OTHER_TOPIC_KEY } from '../config/taxonomy.js';
import cache from '../utils/cache.js';
import { normalizeTags } from '../utils/normalizeTags.js';
import { createProfileSnapshotStore, fetchWithFallback } from './snapshot.service.js';
import * as codeforces from './sources/codeforces.service.js';

/** Submission history lives in its own snapshot row, separate from profile stats. */
const activityStore = createProfileSnapshotStore({ kind: 'activity' });

/**
 * A user's solve history, reduced to the shape the rest of the app needs:
 * which problems are solved/attempted, and how strong each canonical topic is.
 *
 * Used by the problem browser (status marks + topic progress), the profile
 * dashboard and the recommender, so it is fetched once and cached.
 */

const activityCacheKey = (platform, handle) => `activity:${platform}:${handle.toLowerCase()}`;

/** Codeforces submissions -> compact, snapshot-friendly activity payload. */
export const transformCodeforcesSubmissions = (submissions = []) => {
  const solved = new Map();
  const attempted = new Map();

  for (const submission of submissions) {
    const problem = submission?.problem;
    if (!problem) continue;

    const externalId = codeforces.problemExternalId(problem);
    if (!externalId) continue;

    const { canonicalTopics } = normalizeTags(PLATFORMS.CODEFORCES, problem.tags ?? []);

    const entry = {
      id: externalId,
      name: problem.name ?? '',
      rating: Number.isFinite(problem.rating) ? problem.rating : null,
      topics: canonicalTopics,
      at: submission.creationTimeSeconds ?? null,
    };

    if (submission.verdict === 'OK') {
      // Keep the EARLIEST accepted submission as the solve date.
      const existing = solved.get(externalId);
      if (!existing || (entry.at ?? 0) < (existing.at ?? 0)) solved.set(externalId, entry);
      attempted.delete(externalId);
    } else if (!solved.has(externalId)) {
      attempted.set(externalId, entry);
    }
  }

  return {
    solved: [...solved.values()],
    attempted: [...attempted.values()],
    totalSubmissions: submissions.length,
  };
};

const isValidActivity = (value) =>
  Boolean(value && Array.isArray(value.solved) && Array.isArray(value.attempted));

/**
 * Snapshot-backed activity read.
 * @returns {Promise<{data: object, stale: boolean, fetchedAt: Date, source: string}>}
 */
export const getCodeforcesActivity = async (handle, { force = false } = {}) => {
  const key = activityCacheKey(PLATFORMS.CODEFORCES, handle);

  if (!force) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const result = await fetchWithFallback({
    platform: PLATFORMS.CODEFORCES,
    handle,
    source: SOURCES.CODEFORCES_PROFILE,
    fetcher: async () => {
      const submissions = await codeforces.fetchUserStatus(handle);
      return { handle, ...transformCodeforcesSubmissions(submissions) };
    },
    validate: isValidActivity,
    store: activityStore,
  });

  cache.set(key, result, CACHE_TTL.PROFILE);
  return result;
};

/** externalId -> 'solved' | 'attempted' for overlaying onto problem lists. */
export const buildStatusMap = (activity) => {
  const map = new Map();

  for (const entry of activity?.attempted ?? []) map.set(entry.id, 'attempted');
  // Solved wins over attempted.
  for (const entry of activity?.solved ?? []) map.set(entry.id, 'solved');

  return map;
};

/**
 * Per-topic strength inputs. Recency uses the most recent solve in the topic.
 * Only solved problems count - attempts alone do not demonstrate mastery.
 */
export const computeTopicStats = (activity) => {
  const stats = new Map();

  for (const entry of activity?.solved ?? []) {
    const topics = entry.topics?.length ? entry.topics : [OTHER_TOPIC_KEY];

    for (const topicKey of topics) {
      if (!stats.has(topicKey)) {
        stats.set(topicKey, {
          topicKey,
          solved: 0,
          ratedSolved: 0,
          ratingSum: 0,
          averageRating: null,
          maxRating: null,
          lastSolvedAt: null,
        });
      }

      const bucket = stats.get(topicKey);
      bucket.solved += 1;

      if (Number.isFinite(entry.rating)) {
        bucket.ratedSolved += 1;
        bucket.ratingSum += entry.rating;
        bucket.maxRating = Math.max(bucket.maxRating ?? 0, entry.rating);
      }

      if (entry.at && (!bucket.lastSolvedAt || entry.at > bucket.lastSolvedAt)) {
        bucket.lastSolvedAt = entry.at;
      }
    }
  }

  for (const bucket of stats.values()) {
    bucket.averageRating =
      bucket.ratedSolved > 0 ? Math.round(bucket.ratingSum / bucket.ratedSolved) : null;
  }

  return stats;
};

/** Drop cached activity so a manual refresh really refetches. */
export const invalidateActivity = (platform, handle) =>
  cache.del(activityCacheKey(platform, handle));

export default getCodeforcesActivity;
