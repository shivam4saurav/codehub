import { RECOMMENDER } from '../config/constants.js';
import { CANONICAL_TOPICS, OTHER_TOPIC_KEY, getTopic } from '../config/taxonomy.js';

/**
 * Topic strength scoring
 * ---------------------------------------------------------------------------
 * One explainable number per canonical topic, deliberately simple enough to
 * defend in a viva. Documented in the README as:
 *
 *   score = 0.50 x volume + 0.30 x difficulty + 0.20 x recency        (0..1)
 *
 *   volume     = min(1, solved / 40)
 *                "40 solved problems in a topic is treated as full marks."
 *   difficulty = clamp((averageSolvedRating - 800) / (2400 - 800), 0, 1)
 *                Unknown rating (e.g. LeetCode-only topics) scores a neutral
 *                0.5 and is flagged, instead of silently counting as zero.
 *   recency    = 0.5 ^ (daysSinceLastSolve / 45)
 *                "Skill decays; a topic last touched 45 days ago keeps half
 *                 its recency credit."
 *
 * Pure functions only - no I/O - so the whole thing is unit tested.
 */

const RATING_FLOOR = 800;
const RATING_CEILING = 2400;
const NEUTRAL_DIFFICULTY = 0.5;

export const clamp01 = (value) => Math.min(1, Math.max(0, value));

export const volumeComponent = (solved, saturation = RECOMMENDER.VOLUME_SATURATION) =>
  clamp01((solved ?? 0) / saturation);

export const difficultyComponent = (averageRating) => {
  if (!Number.isFinite(averageRating)) return { value: NEUTRAL_DIFFICULTY, known: false };

  return {
    value: clamp01((averageRating - RATING_FLOOR) / (RATING_CEILING - RATING_FLOOR)),
    known: true,
  };
};

/**
 * @param {number|null} lastSolvedAt epoch SECONDS (Codeforces style) or ms
 * @param {number} now epoch ms
 */
export const recencyComponent = (lastSolvedAt, now = Date.now(), halfLifeDays = RECOMMENDER.RECENCY_HALF_LIFE_DAYS) => {
  if (!lastSolvedAt) return 0;

  // Accept both seconds and milliseconds so callers cannot get it subtly wrong.
  const timestampMs = lastSolvedAt > 1e12 ? lastSolvedAt : lastSolvedAt * 1000;
  const days = Math.max(0, (now - timestampMs) / 86_400_000);

  return clamp01(0.5 ** (days / halfLifeDays));
};

/**
 * Score one topic.
 * @returns {{score: number, percent: number, components: object, ratingKnown: boolean}}
 */
export const scoreTopic = (
  { solved = 0, averageRating = null, lastSolvedAt = null },
  { now = Date.now(), weights = RECOMMENDER.WEIGHTS } = {},
) => {
  const volume = volumeComponent(solved);
  const difficulty = difficultyComponent(averageRating);
  const recency = recencyComponent(lastSolvedAt, now);

  const score =
    weights.volume * volume + weights.difficulty * difficulty.value + weights.recency * recency;

  return {
    score: Math.round(score * 1000) / 1000,
    percent: Math.round(score * 100),
    components: {
      volume: Math.round(volume * 1000) / 1000,
      difficulty: Math.round(difficulty.value * 1000) / 1000,
      recency: Math.round(recency * 1000) / 1000,
    },
    ratingKnown: difficulty.known,
  };
};

/** Human-readable justification shown on every recommendation card. */
export const explainTopic = (topicKey, stats) => {
  const topic = getTopic(topicKey);
  const parts = [`${stats.solved} solved`];

  if (Number.isFinite(stats.averageRating)) parts.push(`avg rating ${stats.averageRating}`);

  if (stats.lastSolvedAt) {
    const timestampMs = stats.lastSolvedAt > 1e12 ? stats.lastSolvedAt : stats.lastSolvedAt * 1000;
    const days = Math.round((Date.now() - timestampMs) / 86_400_000);
    parts.push(days <= 1 ? 'solved today' : `last solved ${days}d ago`);
  }

  return `${topic.name} is one of your weaker active topics: ${parts.join(', ')}.`;
};

/**
 * Rank every canonical topic for a user.
 *
 * @param {Map<string, object>|object} statsByTopic topicKey -> { solved, averageRating, lastSolvedAt }
 * @param {{minSolved?: number, weakCount?: number, now?: number}} [options]
 * @returns {{
 *   ranked: Array, active: Array, weak: Array, neverAttempted: Array, lowActivity: Array
 * }}
 */
export const rankTopics = (statsByTopic, options = {}) => {
  const {
    minSolved = RECOMMENDER.MIN_SOLVED_FOR_ACTIVE_TOPIC,
    weakCount = RECOMMENDER.WEAK_TOPIC_COUNT,
    now = Date.now(),
  } = options;

  const stats = statsByTopic instanceof Map ? statsByTopic : new Map(Object.entries(statsByTopic ?? {}));

  const ranked = CANONICAL_TOPICS.map((topic) => {
    const entry = stats.get(topic.key) ?? {};
    const solved = entry.solved ?? 0;
    const scored = scoreTopic(
      {
        solved,
        averageRating: entry.averageRating ?? null,
        lastSolvedAt: entry.lastSolvedAt ?? null,
      },
      { now },
    );

    return {
      topicKey: topic.key,
      name: topic.name,
      short: topic.short,
      accent: topic.accent,
      solved,
      averageRating: entry.averageRating ?? null,
      maxRating: entry.maxRating ?? null,
      lastSolvedAt: entry.lastSolvedAt ?? null,
      ...scored,
      isActive: solved >= minSolved,
      isUntouched: solved === 0,
    };
  }).sort((a, b) => b.score - a.score || b.solved - a.solved);

  const active = ranked.filter((topic) => topic.isActive);

  return {
    ranked,
    active,
    /**
     * Weakest ACTIVE topics only. A topic with 0-2 solves is not "weak", it is
     * unexplored - lumping them together would bury the real gaps.
     */
    weak: [...active].sort((a, b) => a.score - b.score).slice(0, weakCount),
    neverAttempted: ranked.filter((topic) => topic.isUntouched && topic.topicKey !== OTHER_TOPIC_KEY),
    lowActivity: ranked.filter((topic) => topic.solved > 0 && topic.solved < minSolved),
    strongest: ranked.filter((topic) => topic.solved > 0).slice(0, weakCount),
  };
};

export default rankTopics;
