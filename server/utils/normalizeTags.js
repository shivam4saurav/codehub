import {
  OTHER_TOPIC_KEY,
  isNonAlgorithmicTag,
  resolveTag,
  slugifyTag,
} from '../config/taxonomy.js';
import logger from './logger.js';

/**
 * Single entry point for turning raw platform tags into canonical topics.
 * Pure function - no I/O - so it is trivially testable and safe to call in
 * hot loops (problem sync walks ~10k Codeforces problems).
 *
 * @param {string} platform 'codeforces' | 'leetcode' | 'codechef'
 * @param {string[]} rawTags tags exactly as the platform returned them
 * @returns {{
 *   canonicalTopics: string[],
 *   rawTags: string[],
 *   unmapped: string[],
 *   map: Record<string, string>
 * }}
 */
export const normalizeTags = (platform, rawTags = []) => {
  const list = Array.isArray(rawTags) ? rawTags : [rawTags];

  const canonical = new Set();
  const unmapped = [];
  const seenRaw = new Set();
  const cleanRaw = [];
  const map = {};

  for (const rawTag of list) {
    if (rawTag === null || rawTag === undefined) continue;

    const tag = String(rawTag).trim();
    if (!tag) continue;

    const slug = slugifyTag(tag);
    if (!slug) continue;

    if (!seenRaw.has(slug)) {
      seenRaw.add(slug);
      cleanRaw.push(tag);
    }

    const { key, matched } = resolveTag(platform, tag);
    canonical.add(key);
    map[tag] = key;

    if (!matched && !isNonAlgorithmicTag(platform, tag)) unmapped.push(tag);
  }

  // "Other" is only meaningful when nothing else matched.
  if (canonical.size > 1) canonical.delete(OTHER_TOPIC_KEY);
  if (canonical.size === 0) canonical.add(OTHER_TOPIC_KEY);

  return {
    canonicalTopics: [...canonical],
    rawTags: cleanRaw,
    unmapped,
    map,
  };
};

/** In-process dedupe so one unknown tag does not hammer Mongo on every sync. */
const reportedThisProcess = new Set();

/**
 * Persist mapping gaps so the taxonomy can be extended deliberately.
 * Never throws: a logging failure must not break a sync job.
 *
 * @param {string} platform
 * @param {string[]} unmappedTags
 * @param {{ UnmappedTag?: import('mongoose').Model }} [deps] injectable for tests
 */
export const reportUnmappedTags = async (platform, unmappedTags = [], deps = {}) => {
  const unique = [...new Set(unmappedTags.map((tag) => String(tag).trim()).filter(Boolean))];
  if (unique.length === 0) return { recorded: 0 };

  let model = deps.UnmappedTag;
  if (!model) {
    const imported = await import('../models/UnmappedTag.js');
    model = imported.default;
  }

  let recorded = 0;

  for (const rawTag of unique) {
    const dedupeKey = `${platform}::${slugifyTag(rawTag)}`;
    const firstTimeInProcess = !reportedThisProcess.has(dedupeKey);
    reportedThisProcess.add(dedupeKey);

    try {
      await model.updateOne(
        { platform, rawTag },
        {
          $inc: { occurrences: 1 },
          $set: { lastSeenAt: new Date() },
          $setOnInsert: { platform, rawTag, firstSeenAt: new Date() },
        },
        { upsert: true },
      );
      recorded += 1;

      if (firstTimeInProcess) {
        logger.warn('Unmapped platform tag resolved to "Other"', { platform, rawTag });
      }
    } catch (error) {
      logger.error('Failed to record unmapped tag', { platform, rawTag, error });
    }
  }

  return { recorded };
};

/** Convenience wrapper: normalise and record gaps in one call. */
export const normalizeAndReport = async (platform, rawTags, deps) => {
  const result = normalizeTags(platform, rawTags);
  if (result.unmapped.length > 0) {
    await reportUnmappedTags(platform, result.unmapped, deps);
  }
  return result;
};

/** Test helper - clears the in-process dedupe cache. */
export const __resetUnmappedCache = () => reportedThisProcess.clear();

export default normalizeTags;
