/**
 * Shared, non-secret tuning values. Kept in one place so behaviour can be
 * tweaked without hunting through the service layer.
 */

export const PLATFORMS = Object.freeze({
  LEETCODE: 'leetcode',
  CODEFORCES: 'codeforces',
  CODECHEF: 'codechef',
});

export const PLATFORM_LIST = Object.freeze(Object.values(PLATFORMS));

export const PLATFORM_LABELS = Object.freeze({
  [PLATFORMS.LEETCODE]: 'LeetCode',
  [PLATFORMS.CODEFORCES]: 'Codeforces',
  [PLATFORMS.CODECHEF]: 'CodeChef',
});

/** Sources tracked by /api/health. */
export const SOURCES = Object.freeze({
  CODEFORCES_PROBLEMS: 'codeforces:problemset',
  CODEFORCES_CONTESTS: 'codeforces:contests',
  CODEFORCES_PROFILE: 'codeforces:profile',
  LEETCODE_PROFILE: 'leetcode:profile',
  LEETCODE_PROBLEMS: 'leetcode:problemset',
  CODECHEF_PROFILE: 'codechef:profile',
  CLIST_CONTESTS: 'clist:contests',
});

export const CACHE_KEYS = Object.freeze({
  problemFacets: 'problems:facets',
  contestList: 'contests:list',
  profile: (platform, handle) => `profile:${platform}:${handle.toLowerCase()}`,
  recommendations: (userKey) => `recommendations:${userKey}`,
});

export const CACHE_TTL = Object.freeze({
  SHORT: 60,
  PROFILE: 15 * 60,
  CONTESTS: 10 * 60,
  FACETS: 30 * 60,
});

/** LeetCode has no numeric rating on problems; map difficulty to a band. */
export const LEETCODE_DIFFICULTY_WEIGHT = Object.freeze({
  Easy: 1,
  Medium: 2,
  Hard: 3,
});

/** Rough rating equivalents so LeetCode can share the recommender pipeline. */
export const LEETCODE_DIFFICULTY_RATING = Object.freeze({
  Easy: 1200,
  Medium: 1600,
  Hard: 2100,
});

export const RECOMMENDER = Object.freeze({
  /** A topic only counts as "active" (and therefore rankable) at/above this. */
  MIN_SOLVED_FOR_ACTIVE_TOPIC: 3,
  /** How many weak topics to surface. */
  WEAK_TOPIC_COUNT: 3,
  /** Difficulty window above the user's current level. */
  DIFFICULTY_OFFSET_MIN: 100,
  DIFFICULTY_OFFSET_MAX: 200,
  /** Score weights - documented in the README. */
  WEIGHTS: Object.freeze({ volume: 0.5, difficulty: 0.3, recency: 0.2 }),
  /** Solved counts at/above this are treated as "full marks" for volume. */
  VOLUME_SATURATION: 40,
  /** Recency half-life in days. */
  RECENCY_HALF_LIFE_DAYS: 45,
  DEFAULT_COUNT: 12,
  MAX_COUNT: 50,
  /** Fallback rating when a user has no Codeforces rating yet. */
  DEFAULT_RATING: 1200,
});

export const REMINDER_OFFSETS = Object.freeze({
  '1d': 24 * 60 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '15m': 15 * 60 * 1000,
});

export const REMINDER_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  CLAIMED: 'claimed',
  SENT: 'sent',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
});

export const CARD_THEMES = Object.freeze(['dark-neon', 'glass', 'minimal-light', 'gradient']);

export const MAX_HANDLE_LENGTH = 64;

export default {
  PLATFORMS,
  PLATFORM_LIST,
  PLATFORM_LABELS,
  SOURCES,
  CACHE_KEYS,
  CACHE_TTL,
  RECOMMENDER,
  REMINDER_OFFSETS,
  REMINDER_STATUS,
  CARD_THEMES,
};
