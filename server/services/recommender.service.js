import { PLATFORMS, RECOMMENDER } from '../config/constants.js';
import { getTopic } from '../config/taxonomy.js';
import BookmarkNote from '../models/BookmarkNote.js';
import Problem from '../models/Problem.js';
import RecommendationHistory from '../models/RecommendationHistory.js';
import logger from '../utils/logger.js';
import { getLeetCodeProfile } from './profile.service.js';
import { combineTopicStats, estimateLevel } from './profileAggregation.service.js';
import { explainTopic, rankTopics } from './topicScoring.js';
import { computeTopicStats, getCodeforcesActivity } from './userActivity.service.js';

/**
 * Weak-topic recommender
 * ---------------------------------------------------------------------------
 * 1. score every canonical topic from the user's solve history (topicScoring)
 * 2. take the weakest ACTIVE topics (>= 3 solved) - untouched topics are
 *    surfaced separately as "explore", never as "weak"
 * 3. inside each weak topic, pick UNSOLVED problems slightly above the user's
 *    level (rating +100..+200, widened only if that window is empty)
 * 4. attach a plain-English reason to every card
 *
 * Everything is explainable on purpose: a black box would be useless in a viva
 * and unhelpful to the user.
 */

/** Progressively wider rating windows, tried in order until enough problems appear. */
const ratingWindows = (level, offsetMin, offsetMax) => [
  { min: level + offsetMin, max: level + offsetMax, label: 'target' },
  { min: level, max: level + offsetMax + 100, label: 'widened' },
  { min: Math.max(800, level - 200), max: level + offsetMax + 300, label: 'wide' },
  { min: 0, max: 4000, label: 'any' },
];

/** LeetCode has no rating: step up one difficulty tier from what they mostly solve. */
export const nextLeetCodeDifficulty = (solved = {}) => {
  const easy = solved.easy ?? 0;
  const medium = solved.medium ?? 0;
  const hard = solved.hard ?? 0;

  if (medium >= 40 && hard >= 5) return ['Hard', 'Medium'];
  if (easy >= 20 || medium > 0) return ['Medium', 'Hard'];
  return ['Easy', 'Medium'];
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

/**
 * Gather the topic statistics the scorer needs, from whichever platforms the
 * user has. Failures degrade the result instead of breaking it.
 */
export const collectTopicStats = async (handles, { force = false } = {}) => {
  const platformData = { codeforces: null, leetcode: null, codechef: null };
  const solvedExternalIds = new Set();
  const notes = [];

  if (handles[PLATFORMS.CODEFORCES]) {
    try {
      const activity = await getCodeforcesActivity(handles[PLATFORMS.CODEFORCES], { force });
      const stats = computeTopicStats(activity.data);

      for (const entry of activity.data.solved ?? []) solvedExternalIds.add(entry.id);

      platformData.codeforces = {
        topics: [...stats.values()],
        rating: null,
        solvedCount: activity.data.solved?.length ?? 0,
        stale: activity.stale,
      };
    } catch (error) {
      notes.push(`Codeforces history unavailable: ${error.message}`);
      logger.warn('Recommender: Codeforces activity unavailable', { error: error.message });
    }
  }

  if (handles[PLATFORMS.LEETCODE]) {
    try {
      const profile = await getLeetCodeProfile(handles[PLATFORMS.LEETCODE], { force });

      platformData.leetcode = {
        topics: profile.data.topics ?? [],
        solved: profile.data.solved ?? {},
        contestRating: profile.data.contestRating ?? null,
        stale: profile.stale,
      };
    } catch (error) {
      notes.push(`LeetCode profile unavailable: ${error.message}`);
      logger.warn('Recommender: LeetCode profile unavailable', { error: error.message });
    }
  }

  return { platformData, solvedExternalIds, notes };
};

/** Rating of the user, plus the Codeforces rating when we have one. */
const resolveLevel = (platformData, codeforcesProfileRating) => {
  if (Number.isFinite(codeforcesProfileRating)) {
    return { rating: codeforcesProfileRating, basis: 'codeforces-rating' };
  }
  return estimateLevel(platformData);
};

/**
 * Build recommendations.
 *
 * @param {{
 *   userId?: string,
 *   handles: Record<string,string>,
 *   topics?: string[],
 *   count?: number,
 *   difficultyOffset?: number|null,
 *   platform?: string,
 *   shuffleSeed?: boolean,
 *   force?: boolean,
 * }} input
 */
export const getRecommendations = async ({
  userId = null,
  handles = {},
  topics: requestedTopics = [],
  count = RECOMMENDER.DEFAULT_COUNT,
  difficultyOffset = null,
  platform = PLATFORMS.CODEFORCES,
  force = false,
}) => {
  const { platformData, solvedExternalIds, notes } = await collectTopicStats(handles, { force });

  // Codeforces rating (if any) comes from the profile snapshot, not the history.
  let codeforcesRating = null;
  if (handles[PLATFORMS.CODEFORCES]) {
    try {
      const { getCodeforcesProfile } = await import('./profile.service.js');
      const profile = await getCodeforcesProfile(handles[PLATFORMS.CODEFORCES], { force: false });
      codeforcesRating = profile.data.rating ?? null;
    } catch {
      codeforcesRating = null;
    }
  }

  const topicStats = combineTopicStats(platformData);
  const ranking = rankTopics(topicStats);
  const level = resolveLevel(platformData, codeforcesRating);

  // Explicit topics override the automatic weak-topic selection.
  const targetTopics =
    requestedTopics.length > 0
      ? ranking.ranked.filter((topic) => requestedTopics.includes(topic.topicKey))
      : ranking.weak;

  /**
   * Cold start: a user with no history has no "weak" topics. Recommending the
   * fundamentals is far more useful than recommending nothing.
   */
  const fallbackTopics =
    targetTopics.length === 0
      ? ranking.ranked
          .filter((topic) =>
            ['arrays', 'strings', 'hashing', 'two-pointers', 'binary-search', 'greedy'].includes(
              topic.topicKey,
            ),
          )
          .slice(0, RECOMMENDER.WEAK_TOPIC_COUNT)
      : [];

  const workingTopics = targetTopics.length > 0 ? targetTopics : fallbackTopics;
  const isColdStart = targetTopics.length === 0;

  // Problems the user marked done themselves are excluded as well.
  let doneProblemIds = [];
  if (userId) {
    const done = await BookmarkNote.find({ userId, done: true }).select('problemId').lean();
    doneProblemIds = done.map((row) => row.problemId);
  }

  const offsetMin = Number.isFinite(difficultyOffset)
    ? difficultyOffset
    : RECOMMENDER.DIFFICULTY_OFFSET_MIN;
  const offsetMax = Number.isFinite(difficultyOffset)
    ? difficultyOffset + 100
    : RECOMMENDER.DIFFICULTY_OFFSET_MAX;

  const perTopic = Math.max(2, Math.ceil(count / Math.max(1, workingTopics.length)));
  const picked = [];
  const seen = new Set();
  const windowUsed = {};

  const leetcodeDifficulties = nextLeetCodeDifficulty(platformData.leetcode?.solved);

  for (const topic of workingTopics) {
    const baseFilter = {
      platform,
      canonicalTopics: topic.topicKey,
      ...(doneProblemIds.length > 0 ? { _id: { $nin: doneProblemIds } } : {}),
      ...(solvedExternalIds.size > 0 && platform === PLATFORMS.CODEFORCES
        ? { externalId: { $nin: [...solvedExternalIds] } }
        : {}),
      ...(platform === PLATFORMS.LEETCODE
        ? { difficulty: { $in: leetcodeDifficulties }, isPremium: { $ne: true } }
        : {}),
    };

    /**
     * Windows are tried from tightest to widest and results are ACCUMULATED,
     * so problems inside the ideal band are always used first. A wider window
     * only ever tops up the remaining slots - it never displaces a good match.
     */
    const collected = [];
    const collectedIds = new Set();

    for (const window of ratingWindows(level.rating, offsetMin, offsetMax)) {
      const filter =
        platform === PLATFORMS.CODEFORCES
          ? { ...baseFilter, rating: { $gte: window.min, $lte: window.max } }
          : baseFilter;

      // Popular problems first: they have editorials and are better practice.
      const rows = await Problem.find(filter)
        .sort({ solvedCount: -1 })
        .limit(perTopic * 6)
        .lean();

      // Shuffle inside the band so "shuffle" returns a genuinely new draw.
      for (const row of shuffle(rows)) {
        const id = String(row._id);
        if (collectedIds.has(id)) continue;
        collectedIds.add(id);
        collected.push({ row, window });
      }

      windowUsed[topic.topicKey] = window;

      if (collected.length >= perTopic) break;
      if (platform === PLATFORMS.LEETCODE) break; // no rating windows to widen
    }

    for (const { row: candidate, window } of collected.slice(0, perTopic)) {
      const id = String(candidate._id);
      if (seen.has(id)) continue;
      seen.add(id);

      const reason = isColdStart
        ? `${getTopic(topic.topicKey).name} is a good starting point - no solve history yet, so CodeHub suggests fundamentals first.`
        : explainTopic(topic.topicKey, {
            solved: topic.solved,
            averageRating: topic.averageRating,
            lastSolvedAt: topic.lastSolvedAt,
          });

      picked.push({
        problemId: candidate._id,
        id,
        platform: candidate.platform,
        externalId: candidate.externalId,
        name: candidate.name,
        url: candidate.url,
        rating: candidate.rating ?? null,
        difficulty: candidate.difficulty ?? null,
        solvedCount: candidate.solvedCount ?? 0,
        canonicalTopics: candidate.canonicalTopics ?? [],
        topicKey: topic.topicKey,
        topicName: getTopic(topic.topicKey).name,
        topicScore: topic.percent,
        reason,
        // Per-item, so the UI can flag exactly which cards fell outside the band.
        targetWindow: window,
      });
    }
  }

  // Interleave topics so the list does not open with six DP problems.
  const byTopic = new Map();
  for (const item of picked) {
    if (!byTopic.has(item.topicKey)) byTopic.set(item.topicKey, []);
    byTopic.get(item.topicKey).push(item);
  }

  const interleaved = [];
  let exhausted = false;
  while (interleaved.length < count && !exhausted) {
    exhausted = true;
    for (const list of byTopic.values()) {
      const next = list.shift();
      if (next) {
        interleaved.push(next);
        exhausted = false;
        if (interleaved.length >= count) break;
      }
    }
  }

  const result = {
    items: interleaved,
    weakTopics: workingTopics.map((topic) => ({
      topicKey: topic.topicKey,
      name: topic.name,
      accent: topic.accent,
      solved: topic.solved,
      averageRating: topic.averageRating,
      score: topic.percent,
      status: isColdStart ? 'cold-start' : 'weak',
    })),
    exploreTopics: ranking.neverAttempted.slice(0, 6).map((topic) => ({
      topicKey: topic.topicKey,
      name: topic.name,
      accent: topic.accent,
    })),
    lowActivityTopics: ranking.lowActivity.slice(0, 6).map((topic) => ({
      topicKey: topic.topicKey,
      name: topic.name,
      solved: topic.solved,
    })),
    level,
    target: {
      platform,
      ratingMin: level.rating + offsetMin,
      ratingMax: level.rating + offsetMax,
      leetcodeDifficulties: platform === PLATFORMS.LEETCODE ? leetcodeDifficulties : undefined,
    },
    meta: {
      isColdStart,
      requestedTopics,
      excludedSolved: solvedExternalIds.size,
      excludedDone: doneProblemIds.length,
      notes,
      minSolvedForActiveTopic: RECOMMENDER.MIN_SOLVED_FOR_ACTIVE_TOPIC,
      formula: 'score = 0.50 x volume + 0.30 x difficulty + 0.20 x recency',
    },
  };

  // Keep a history row so "Practice next" can show what was suggested before.
  if (userId && interleaved.length > 0) {
    RecommendationHistory.create({
      userId,
      params: { count, difficultyOffset, topics: requestedTopics },
      weakTopics: result.weakTopics.map((topic) => ({
        topicKey: topic.topicKey,
        score: topic.score ?? 0,
        solved: topic.solved ?? 0,
        averageRating: topic.averageRating ?? null,
        status: isColdStart ? 'never-attempted' : 'weak',
      })),
      items: interleaved.map((item) => ({
        problemId: item.problemId,
        platform: item.platform,
        externalId: item.externalId,
        name: item.name,
        url: item.url,
        rating: item.rating,
        difficulty: item.difficulty,
        topicKey: item.topicKey,
        reason: item.reason,
      })),
    }).catch((error) =>
      logger.warn('Could not store recommendation history', { error: error.message }),
    );
  }

  return result;
};

export const getRecommendationHistory = async (userId, { limit = 10 } = {}) => {
  const rows = await RecommendationHistory.find({ userId })
    .sort({ generatedAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    generatedAt: row.generatedAt,
    weakTopics: row.weakTopics ?? [],
    itemCount: row.items?.length ?? 0,
    items: (row.items ?? []).slice(0, 6),
  }));
};

export default getRecommendations;
