import { PLATFORMS, PLATFORM_LIST, RECOMMENDER } from '../config/constants.js';
import { CANONICAL_TOPICS } from '../config/taxonomy.js';
import { PROFILE_FETCHERS } from './profile.service.js';
import { settleAll } from './snapshot.service.js';
import { rankTopics } from './topicScoring.js';

/**
 * Merges up to three platform profiles into one dashboard payload.
 *
 * Hard rule: platforms are fetched with Promise.allSettled, so CodeChef being
 * down (or LeetCode changing its GraphQL shape) degrades exactly one card and
 * leaves the rest of the dashboard intact.
 */

/** Merge per-day activity counts from every platform into one heatmap. */
export const mergeHeatmaps = (heatmaps = []) => {
  const merged = {};

  for (const heatmap of heatmaps) {
    for (const [day, count] of Object.entries(heatmap ?? {})) {
      merged[day] = (merged[day] ?? 0) + Number(count || 0);
    }
  }

  return merged;
};

/** Longest and current run of consecutive active days, in UTC. */
export const computeStreaks = (heatmap = {}) => {
  const days = Object.keys(heatmap)
    .filter((day) => heatmap[day] > 0)
    .sort();

  if (days.length === 0) return { current: 0, longest: 0, activeDays: 0, totalSubmissions: 0 };

  const toDay = (value) => Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 86_400_000);

  let longest = 1;
  let run = 1;

  for (let index = 1; index < days.length; index += 1) {
    const gap = toDay(days[index]) - toDay(days[index - 1]);
    run = gap === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // "Current" tolerates today being empty, so a morning visit still counts.
  const today = Math.floor(Date.now() / 86_400_000);
  const lastDay = toDay(days.at(-1));
  const current = today - lastDay <= 1 ? run : 0;

  return {
    current,
    longest,
    activeDays: days.length,
    totalSubmissions: Object.values(heatmap).reduce((sum, count) => sum + Number(count || 0), 0),
  };
};

/** Canonical topic -> solved counts, split per platform and combined. */
export const combineTopicStats = (platformData) => {
  const combined = new Map();

  const addTopic = (topicKey, platform, payload) => {
    if (!combined.has(topicKey)) {
      combined.set(topicKey, {
        topicKey,
        solved: 0,
        byPlatform: { codeforces: 0, leetcode: 0, codechef: 0 },
        ratingSum: 0,
        ratedSolved: 0,
        averageRating: null,
        maxRating: null,
        lastSolvedAt: null,
      });
    }

    const bucket = combined.get(topicKey);
    bucket.solved += payload.solved ?? 0;
    bucket.byPlatform[platform] = (bucket.byPlatform[platform] ?? 0) + (payload.solved ?? 0);

    if (Number.isFinite(payload.averageRating) && payload.solved > 0) {
      bucket.ratingSum += payload.averageRating * payload.solved;
      bucket.ratedSolved += payload.solved;
    }

    if (Number.isFinite(payload.maxRating)) {
      bucket.maxRating = Math.max(bucket.maxRating ?? 0, payload.maxRating);
    }

    if (payload.lastSolvedAt && (!bucket.lastSolvedAt || payload.lastSolvedAt > bucket.lastSolvedAt)) {
      bucket.lastSolvedAt = payload.lastSolvedAt;
    }
  };

  for (const platform of PLATFORM_LIST) {
    for (const topic of platformData[platform]?.topics ?? []) {
      addTopic(topic.topicKey, platform, topic);
    }
  }

  for (const bucket of combined.values()) {
    bucket.averageRating =
      bucket.ratedSolved > 0 ? Math.round(bucket.ratingSum / bucket.ratedSolved) : null;
  }

  return combined;
};

/** Radar series: one row per topic with a value per platform. */
export const buildRadarData = (topicStats, { limit = 10 } = {}) => {
  const rows = CANONICAL_TOPICS.map((topic) => {
    const stats = topicStats.get(topic.key);

    return {
      topicKey: topic.key,
      topic: topic.short,
      name: topic.name,
      accent: topic.accent,
      codeforces: stats?.byPlatform.codeforces ?? 0,
      leetcode: stats?.byPlatform.leetcode ?? 0,
      codechef: stats?.byPlatform.codechef ?? 0,
      total: stats?.solved ?? 0,
    };
  })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return rows;
};

/** The user's working difficulty level, used to target recommendations. */
export const estimateLevel = (platformData) => {
  const codeforcesRating = platformData[PLATFORMS.CODEFORCES]?.rating ?? null;
  if (Number.isFinite(codeforcesRating)) {
    return { rating: codeforcesRating, basis: 'codeforces-rating' };
  }

  const leetcodeContest = platformData[PLATFORMS.LEETCODE]?.contestRating ?? null;
  if (Number.isFinite(leetcodeContest)) {
    // LeetCode contest ratings sit on a different scale; shift them closer to
    // the Codeforces band so the +100..200 window still means something.
    return { rating: Math.round(leetcodeContest * 0.85), basis: 'leetcode-contest-rating' };
  }

  const solvedTotal =
    (platformData[PLATFORMS.CODEFORCES]?.solvedCount ?? 0) +
    (platformData[PLATFORMS.LEETCODE]?.solved?.total ?? 0);

  if (solvedTotal > 0) {
    // Crude but explainable: experience nudges the assumed level upward.
    const inferred = 1000 + Math.min(600, Math.round(solvedTotal / 2) * 10);
    return { rating: inferred, basis: 'solved-volume' };
  }

  return { rating: RECOMMENDER.DEFAULT_RATING, basis: 'default' };
};

/**
 * Build the whole dashboard.
 *
 * @param {{handles: Record<string,string>, force?: boolean}} input
 */
export const buildDashboard = async ({ handles, force = false }) => {
  const requested = PLATFORM_LIST.filter((platform) => handles[platform]);

  const tasks = Object.fromEntries(
    requested.map((platform) => [
      platform,
      () => PROFILE_FETCHERS[platform](handles[platform], { force }),
    ]),
  );

  const { results, statuses } = await settleAll(tasks);

  const platformData = {
    [PLATFORMS.CODEFORCES]: results[PLATFORMS.CODEFORCES] ?? null,
    [PLATFORMS.LEETCODE]: results[PLATFORMS.LEETCODE] ?? null,
    [PLATFORMS.CODECHEF]: results[PLATFORMS.CODECHEF] ?? null,
  };

  const topicStats = combineTopicStats(platformData);
  const ranking = rankTopics(topicStats);

  const heatmap = mergeHeatmaps([
    platformData[PLATFORMS.CODEFORCES]?.heatmap,
    platformData[PLATFORMS.LEETCODE]?.heatmap,
  ]);

  const solvedByPlatform = {
    codeforces: platformData[PLATFORMS.CODEFORCES]?.solvedCount ?? 0,
    leetcode: platformData[PLATFORMS.LEETCODE]?.solved?.total ?? 0,
    codechef: platformData[PLATFORMS.CODECHEF]?.problemsSolved ?? 0,
  };

  const level = estimateLevel(platformData);

  return {
    handles,
    platforms: platformData,
    statuses,
    combined: {
      totalSolved: Object.values(solvedByPlatform).reduce((sum, count) => sum + count, 0),
      solvedByPlatform,
      contests:
        (platformData[PLATFORMS.CODEFORCES]?.contestsCount ?? 0) +
        (platformData[PLATFORMS.LEETCODE]?.contestsCount ?? 0),
      ratings: {
        codeforces: platformData[PLATFORMS.CODEFORCES]?.rating ?? null,
        codeforcesMax: platformData[PLATFORMS.CODEFORCES]?.maxRating ?? null,
        leetcode: platformData[PLATFORMS.LEETCODE]?.contestRating ?? null,
        codechef: platformData[PLATFORMS.CODECHEF]?.rating ?? null,
        codechefStars: platformData[PLATFORMS.CODECHEF]?.stars ?? null,
      },
      heatmap,
      streaks: computeStreaks(heatmap),
      topics: ranking.ranked,
      strongest: ranking.strongest,
      weakest: ranking.weak,
      neverAttempted: ranking.neverAttempted.slice(0, 6),
      radar: buildRadarData(topicStats),
      level,
      // Any platform served from a snapshot flags the whole dashboard as partly stale.
      anyStale: Object.values(statuses).some((status) => status.stale),
      anyFailed: Object.values(statuses).some((status) => !status.ok),
    },
  };
};

export default buildDashboard;
