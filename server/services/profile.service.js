import { CACHE_TTL, PLATFORMS, SOURCES } from '../config/constants.js';
import { OTHER_TOPIC_KEY } from '../config/taxonomy.js';
import cache from '../utils/cache.js';
import { normalizeTags } from '../utils/normalizeTags.js';
import { createProfileSnapshotStore, fetchWithFallback } from './snapshot.service.js';
import * as codechef from './sources/codechef.service.js';
import * as codeforces from './sources/codeforces.service.js';
import * as leetcode from './sources/leetcode.service.js';
import { computeTopicStats, getCodeforcesActivity } from './userActivity.service.js';

/**
 * Per-platform profile reads, each normalised into a shared shape so the
 * dashboard does not care which judge the numbers came from.
 *
 * Every function returns the snapshot envelope:
 *   { data, stale, fetchedAt, source, staleReason? }
 */

const profileStore = createProfileSnapshotStore({ kind: 'profile' });

const cacheKey = (platform, handle) => `profile:${platform}:${handle.toLowerCase()}`;

const cached = async (platform, handle, { force }, producer) => {
  const key = cacheKey(platform, handle);

  if (!force) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const result = await producer();
  cache.set(key, result, CACHE_TTL.PROFILE);
  return result;
};

/** YYYY-MM-DD in UTC, the bucket key for every heatmap. */
export const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/* ------------------------------------------------------------- codeforces */

const isValidCodeforcesProfile = (value) =>
  Boolean(value && typeof value.handle === 'string' && Array.isArray(value.ratingHistory));

export const getCodeforcesProfile = async (handle, { force = false } = {}) =>
  cached(PLATFORMS.CODEFORCES, handle, { force }, () =>
    fetchWithFallback({
      platform: PLATFORMS.CODEFORCES,
      handle,
      source: SOURCES.CODEFORCES_PROFILE,
      store: profileStore,
      validate: isValidCodeforcesProfile,
      fetcher: async () => {
        // Two sequential calls; the shared queue keeps them 2s apart.
        const info = await codeforces.fetchUserInfo(handle);
        const ratingHistory = await codeforces.fetchUserRating(handle);

        return {
          handle: info.handle,
          displayName: [info.firstName, info.lastName].filter(Boolean).join(' ') || info.handle,
          avatarUrl: info.titlePhoto ?? info.avatar ?? null,
          rating: info.rating ?? null,
          maxRating: info.maxRating ?? null,
          rank: info.rank ?? null,
          maxRank: info.maxRank ?? null,
          contribution: info.contribution ?? 0,
          friendOfCount: info.friendOfCount ?? 0,
          country: info.country ?? null,
          organization: info.organization ?? null,
          registeredAt: info.registrationTimeSeconds
            ? new Date(info.registrationTimeSeconds * 1000).toISOString()
            : null,
          contestsCount: ratingHistory.length,
          ratingHistory: ratingHistory.map((entry) => ({
            contestId: entry.contestId,
            contestName: entry.contestName,
            rank: entry.rank,
            oldRating: entry.oldRating,
            newRating: entry.newRating,
            at: new Date(entry.ratingUpdateTimeSeconds * 1000).toISOString(),
          })),
          profileUrl: `https://codeforces.com/profile/${encodeURIComponent(info.handle)}`,
        };
      },
    }),
  );

/**
 * Codeforces profile + derived solve analytics (topic strengths, heatmap).
 * Activity comes from its own snapshot, so a user.status failure still leaves
 * rating and rank intact.
 */
export const getCodeforcesDashboard = async (handle, { force = false } = {}) => {
  const [profileResult, activityResult] = await Promise.allSettled([
    getCodeforcesProfile(handle, { force }),
    getCodeforcesActivity(handle, { force }),
  ]);

  if (profileResult.status === 'rejected') throw profileResult.reason;

  const profile = profileResult.value;
  const activity = activityResult.status === 'fulfilled' ? activityResult.value : null;

  const solved = activity?.data?.solved ?? [];
  const topicStats = activity ? computeTopicStats(activity.data) : new Map();

  const heatmap = {};
  for (const entry of solved) {
    if (!entry.at) continue;
    const key = dayKey(entry.at * 1000);
    heatmap[key] = (heatmap[key] ?? 0) + 1;
  }

  return {
    data: {
      ...profile.data,
      solvedCount: solved.length,
      attemptedCount: activity?.data?.attempted?.length ?? 0,
      totalSubmissions: activity?.data?.totalSubmissions ?? null,
      topics: [...topicStats.values()],
      heatmap,
      activityAvailable: Boolean(activity),
    },
    stale: profile.stale || Boolean(activity?.stale),
    fetchedAt: profile.fetchedAt,
    source: profile.source,
    staleReason: profile.staleReason ?? activity?.staleReason,
  };
};

/* --------------------------------------------------------------- leetcode */

const isValidLeetCodeProfile = (value) =>
  Boolean(value && typeof value.handle === 'string' && value.solved);

/** LeetCode's tagProblemCounts buckets -> canonical topic stats. */
const leetcodeTopicStats = (tagProblemCounts) => {
  const buckets = [
    ...(tagProblemCounts?.fundamental ?? []),
    ...(tagProblemCounts?.intermediate ?? []),
    ...(tagProblemCounts?.advanced ?? []),
  ];

  const byTopic = new Map();

  for (const bucket of buckets) {
    const { canonicalTopics } = normalizeTags(PLATFORMS.LEETCODE, [bucket.tagName]);
    const topicKey = canonicalTopics[0] ?? OTHER_TOPIC_KEY;

    const existing = byTopic.get(topicKey) ?? { topicKey, solved: 0, rawTags: [] };
    existing.solved += bucket.problemsSolved ?? 0;
    existing.rawTags.push(bucket.tagName);
    byTopic.set(topicKey, existing);
  }

  return [...byTopic.values()];
};

export const getLeetCodeProfile = async (handle, { force = false } = {}) =>
  cached(PLATFORMS.LEETCODE, handle, { force }, () =>
    fetchWithFallback({
      platform: PLATFORMS.LEETCODE,
      handle,
      source: SOURCES.LEETCODE_PROFILE,
      store: profileStore,
      validate: isValidLeetCodeProfile,
      fetcher: async () => {
        const profile = await leetcode.fetchUserProfile(handle);

        // Contest info is a bonus: never fail the profile because of it.
        let contest = { ranking: null, history: [] };
        try {
          contest = await leetcode.fetchUserContestInfo(handle);
        } catch {
          contest = { ranking: null, history: [], unavailable: true };
        }

        const user = profile.matchedUser;
        const acCounts = user.submitStatsGlobal?.acSubmissionNum ?? [];

        const byDifficulty = Object.fromEntries(
          acCounts.map((entry) => [entry.difficulty.toLowerCase(), entry.count]),
        );

        const totals = Object.fromEntries(
          (profile.allQuestionsCount ?? []).map((entry) => [
            entry.difficulty.toLowerCase(),
            entry.count,
          ]),
        );

        // submissionCalendar is a JSON string of "epochSeconds": count.
        let heatmap = {};
        try {
          const raw = JSON.parse(user.userCalendar?.submissionCalendar ?? '{}');
          heatmap = Object.fromEntries(
            Object.entries(raw).map(([seconds, count]) => [dayKey(Number(seconds) * 1000), count]),
          );
        } catch {
          heatmap = {};
        }

        return {
          handle: user.username,
          displayName: user.profile?.realName || user.username,
          avatarUrl: user.profile?.userAvatar ?? null,
          country: user.profile?.countryName ?? null,
          globalRanking: user.profile?.ranking ?? null,
          reputation: user.profile?.reputation ?? 0,
          solved: {
            easy: byDifficulty.easy ?? 0,
            medium: byDifficulty.medium ?? 0,
            hard: byDifficulty.hard ?? 0,
            total: byDifficulty.all ?? 0,
          },
          totals: {
            easy: totals.easy ?? 0,
            medium: totals.medium ?? 0,
            hard: totals.hard ?? 0,
            all: totals.all ?? 0,
          },
          badges: (user.badges ?? []).slice(0, 8).map((badge) => ({
            id: badge.id,
            name: badge.displayName,
            icon: badge.icon,
          })),
          streak: user.userCalendar?.streak ?? 0,
          totalActiveDays: user.userCalendar?.totalActiveDays ?? 0,
          contestRating: contest.ranking?.rating ? Math.round(contest.ranking.rating) : null,
          contestsCount: contest.ranking?.attendedContestsCount ?? 0,
          contestGlobalRanking: contest.ranking?.globalRanking ?? null,
          topPercentage: contest.ranking?.topPercentage ?? null,
          ratingHistory: (contest.history ?? []).slice(-40).map((entry) => ({
            contestName: entry.contest?.title ?? '',
            newRating: entry.rating ? Math.round(entry.rating) : null,
            rank: entry.ranking ?? null,
            at: entry.contest?.startTime
              ? new Date(entry.contest.startTime * 1000).toISOString()
              : null,
          })),
          topics: leetcodeTopicStats(user.tagProblemCounts),
          heatmap,
          profileUrl: `https://leetcode.com/u/${encodeURIComponent(user.username)}/`,
        };
      },
    }),
  );

/* --------------------------------------------------------------- codechef */

export const getCodeChefProfile = async (handle, { force = false } = {}) =>
  cached(PLATFORMS.CODECHEF, handle, { force }, () =>
    fetchWithFallback({
      platform: PLATFORMS.CODECHEF,
      handle,
      source: SOURCES.CODECHEF_PROFILE,
      store: profileStore,
      validate: codechef.isValidProfile,
      fetcher: () => codechef.fetchUserProfile(handle),
    }),
  );

/** One entry point per platform, used by the aggregator. */
export const PROFILE_FETCHERS = {
  [PLATFORMS.CODEFORCES]: getCodeforcesDashboard,
  [PLATFORMS.LEETCODE]: getLeetCodeProfile,
  [PLATFORMS.CODECHEF]: getCodeChefProfile,
};

export const invalidateProfileCache = (platform, handle) =>
  cache.del(cacheKey(platform, handle));

export default PROFILE_FETCHERS;
