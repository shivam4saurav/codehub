import { PLATFORMS } from '../config/constants.js';
import Problem from '../models/Problem.js';
import cache from '../utils/cache.js';
import logger from '../utils/logger.js';
import { normalizeTags, reportUnmappedTags } from '../utils/normalizeTags.js';
import * as codeforces from './sources/codeforces.service.js';
import * as leetcode from './sources/leetcode.service.js';

/**
 * Keeps the local `problems` collection in sync with the platforms.
 *
 * Safety rules:
 *  - problems are only ever upserted, never deleted, so a partial upstream
 *    response can never empty the browser;
 *  - the adapters validate response shape first, so a changed payload aborts
 *    the sync instead of writing junk;
 *  - unmapped tags are recorded for taxonomy maintenance.
 */

const BULK_CHUNK = 1000;

const writeInChunks = async (operations) => {
  let upserted = 0;
  let modified = 0;

  for (let index = 0; index < operations.length; index += BULK_CHUNK) {
    const chunk = operations.slice(index, index + BULK_CHUNK);
    // ordered:false so one bad document cannot abort the whole batch.
    const result = await Problem.bulkWrite(chunk, { ordered: false });
    upserted += result.upsertedCount ?? 0;
    modified += result.modifiedCount ?? 0;
  }

  return { upserted, modified };
};

/* -------------------------------------------------------------- codeforces */

export const syncCodeforcesProblems = async () => {
  const startedAt = Date.now();

  const { problems, problemStatistics } = await codeforces.fetchProblemset();

  // solvedCount lives in a parallel array keyed by contestId+index.
  const solvedCounts = new Map(
    problemStatistics.map((stat) => [`${stat.contestId}-${stat.index}`, stat.solvedCount]),
  );

  // Contest names give us division and the problem's original date.
  let contestsById = new Map();
  try {
    const contests = await codeforces.fetchContestList({ gym: false });
    contestsById = new Map(contests.map((contest) => [contest.id, contest]));
  } catch (error) {
    // Non-fatal: we simply lose division/date enrichment for this run.
    logger.warn('Contest list unavailable during problem sync', { error: error.message });
  }

  const operations = [];
  const unmapped = new Set();
  const now = new Date();

  for (const problem of problems) {
    const externalId = codeforces.problemExternalId(problem);
    if (!externalId || !problem.name) continue;

    const { canonicalTopics, rawTags, unmapped: gaps } = normalizeTags(
      PLATFORMS.CODEFORCES,
      problem.tags ?? [],
    );
    for (const gap of gaps) unmapped.add(gap);

    const contest = problem.contestId ? contestsById.get(problem.contestId) : null;
    const rating = Number.isFinite(problem.rating) ? problem.rating : null;

    operations.push({
      updateOne: {
        filter: { platform: PLATFORMS.CODEFORCES, externalId },
        update: {
          $set: {
            name: problem.name,
            url: codeforces.problemUrl(problem),
            rawTags,
            canonicalTopics,
            rating,
            difficulty: codeforces.ratingToDifficulty(rating),
            solvedCount: solvedCounts.get(`${problem.contestId}-${problem.index}`) ?? 0,
            contestId: problem.contestId ?? null,
            index: problem.index ?? '',
            contestName: contest?.name ?? '',
            division: contest ? codeforces.parseDivision(contest.name) : null,
            contestStartTime: contest?.startTimeSeconds
              ? new Date(contest.startTimeSeconds * 1000)
              : null,
            sourceFetchedAt: now,
          },
          $setOnInsert: { platform: PLATFORMS.CODEFORCES, externalId },
        },
        upsert: true,
      },
    });
  }

  const { upserted, modified } = await writeInChunks(operations);

  if (unmapped.size > 0) {
    await reportUnmappedTags(PLATFORMS.CODEFORCES, [...unmapped]);
  }

  // Facet counts are derived from this collection.
  cache.invalidatePrefix('problems:');

  const stats = {
    platform: PLATFORMS.CODEFORCES,
    fetched: problems.length,
    upserted,
    modified,
    unmappedTags: [...unmapped],
    durationMs: Date.now() - startedAt,
  };

  logger.info('Codeforces problem sync complete', stats);
  return stats;
};

/* ---------------------------------------------------------------- leetcode */

/**
 * LeetCode pages 100 problems at a time. `maxPages` bounds a single run so a
 * scheduled sync can never turn into an unbounded crawl.
 */
export const syncLeetCodeProblems = async ({ maxPages = 40, pageSize = 100 } = {}) => {
  const startedAt = Date.now();

  const operations = [];
  const unmapped = new Set();
  const now = new Date();

  let skip = 0;
  let total = null;
  let pages = 0;

  while (pages < maxPages) {
    const page = await leetcode.fetchProblemPage({ limit: pageSize, skip });
    total ??= page.total;

    if (page.questions.length === 0) break;

    for (const question of page.questions) {
      const rawTagNames = (question.topicTags ?? []).map((tag) => tag.name);
      const { canonicalTopics, rawTags, unmapped: gaps } = normalizeTags(
        PLATFORMS.LEETCODE,
        rawTagNames,
      );
      for (const gap of gaps) unmapped.add(gap);

      operations.push({
        updateOne: {
          filter: { platform: PLATFORMS.LEETCODE, externalId: question.titleSlug },
          update: {
            $set: {
              name: question.title,
              url: leetcode.problemUrl(question.titleSlug),
              rawTags,
              canonicalTopics,
              rating: leetcode.difficultyToRating(question.difficulty),
              difficulty: question.difficulty ?? null,
              acceptanceRate:
                typeof question.acRate === 'number' ? Math.round(question.acRate * 10) / 10 : null,
              isPremium: Boolean(question.isPaidOnly),
              index: question.questionFrontendId ?? '',
              sourceFetchedAt: now,
            },
            $setOnInsert: { platform: PLATFORMS.LEETCODE, externalId: question.titleSlug },
          },
          upsert: true,
        },
      });
    }

    skip += pageSize;
    pages += 1;

    if (total !== null && skip >= total) break;
  }

  const { upserted, modified } = await writeInChunks(operations);

  if (unmapped.size > 0) {
    await reportUnmappedTags(PLATFORMS.LEETCODE, [...unmapped]);
  }

  cache.invalidatePrefix('problems:');

  const stats = {
    platform: PLATFORMS.LEETCODE,
    fetched: operations.length,
    reportedTotal: total,
    upserted,
    modified,
    unmappedTags: [...unmapped],
    durationMs: Date.now() - startedAt,
  };

  logger.info('LeetCode problem sync complete', stats);
  return stats;
};

/**
 * Sync both platforms independently: LeetCode being unavailable must not stop
 * the Codeforces refresh (and vice versa).
 */
export const syncAllProblems = async () => {
  const outcomes = await Promise.allSettled([syncCodeforcesProblems(), syncLeetCodeProblems()]);

  return outcomes.map((outcome, index) => {
    const platform = index === 0 ? PLATFORMS.CODEFORCES : PLATFORMS.LEETCODE;

    if (outcome.status === 'fulfilled') return { ok: true, ...outcome.value };

    logger.error('Problem sync failed', { platform, error: outcome.reason?.message });
    return { ok: false, platform, error: outcome.reason?.message ?? 'unknown error' };
  });
};

export default syncAllProblems;
