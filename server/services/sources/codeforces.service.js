import axios from 'axios';

import env from '../../config/env.js';
import { SOURCES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import RequestQueue from '../../utils/requestQueue.js';
import { isTransientError, withRetry } from '../../utils/retry.js';
import { recordFailure, recordSuccess } from '../sourceHealth.service.js';

/**
 * Codeforces official API adapter.
 * ---------------------------------------------------------------------------
 * Codeforces blocks clients that call faster than roughly one request every
 * two seconds, so EVERY call in the process funnels through one shared queue.
 * Nothing else in the codebase is allowed to talk to codeforces.com directly.
 *
 * Docs: https://codeforces.com/apiHelp
 */

const client = axios.create({
  baseURL: env.CODEFORCES_API_BASE,
  timeout: 20_000,
  headers: {
    'User-Agent': 'CodeHub/1.0 (capstone project; contact via app)',
    Accept: 'application/json',
  },
  // Codeforces answers 400 with a useful JSON body, so read it ourselves.
  validateStatus: (status) => status < 500,
});

/** One queue per process: shared by problem sync, profiles and contests. */
export const codeforcesQueue = new RequestQueue({
  minIntervalMs: env.CODEFORCES_MIN_INTERVAL_MS,
  name: 'codeforces',
});

/** Codeforces reports a missing handle as a FAILED comment, not a 404. */
const isHandleNotFound = (comment = '') =>
  /not found/i.test(comment) && /handle/i.test(comment);

const callCodeforces = async (endpoint, params = {}, { source, label } = {}) => {
  const startedAt = Date.now();

  const run = () =>
    codeforcesQueue.add(async () => {
      const response = await client.get(`/${endpoint}`, { params });
      const body = response.data;

      if (body?.status === 'FAILED') {
        const comment = body.comment ?? 'Codeforces rejected the request';

        if (isHandleNotFound(comment)) {
          throw ApiError.notFound(comment, { code: 'HANDLE_NOT_FOUND' });
        }

        // 4xx from Codeforces is a permanent answer - do not retry it.
        const error = new ApiError(response.status === 400 ? 400 : 502, comment, {
          code: 'CODEFORCES_FAILED',
        });
        throw error;
      }

      if (body?.status !== 'OK' || body.result === undefined) {
        throw ApiError.badGateway('Codeforces returned an unrecognised envelope');
      }

      return body.result;
    });

  try {
    const result = await withRetry(run, {
      label: label ?? `codeforces:${endpoint}`,
      retries: 2,
      baseDelayMs: 2500,
      // A 404 handle or a rejected query will never succeed on retry.
      shouldRetry: (error) =>
        !(error instanceof ApiError && error.statusCode < 500) && isTransientError(error),
    });

    if (source) recordSuccess(source, { latencyMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    if (source && !(error instanceof ApiError && error.statusCode === 404)) {
      recordFailure(source, error);
    }
    throw error;
  }
};

/* ------------------------------------------------------------------ problems */

/** Shape guard: a usable problemset response. */
export const isValidProblemset = (value) =>
  Boolean(
    value &&
      Array.isArray(value.problems) &&
      value.problems.length > 0 &&
      Array.isArray(value.problemStatistics) &&
      typeof value.problems[0]?.name === 'string' &&
      typeof value.problems[0]?.index === 'string',
  );

/**
 * Whole Codeforces problemset (~10k problems, a few MB).
 * Called by the sync job, never by a request handler.
 */
export const fetchProblemset = async () => {
  const result = await callCodeforces(
    'problemset.problems',
    {},
    { source: SOURCES.CODEFORCES_PROBLEMS, label: 'codeforces:problemset' },
  );

  if (!isValidProblemset(result)) {
    throw ApiError.badGateway('Codeforces problemset response shape changed');
  }

  logger.info('Fetched Codeforces problemset', {
    problems: result.problems.length,
    statistics: result.problemStatistics.length,
  });

  return result;
};

/* ------------------------------------------------------------------ contests */

export const isValidContestList = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  typeof value[0]?.id === 'number' &&
  typeof value[0]?.name === 'string';

export const fetchContestList = async ({ gym = false } = {}) => {
  const result = await callCodeforces(
    'contest.list',
    { gym },
    { source: SOURCES.CODEFORCES_CONTESTS, label: 'codeforces:contest.list' },
  );

  if (!isValidContestList(result)) {
    throw ApiError.badGateway('Codeforces contest.list response shape changed');
  }

  return result;
};

/* -------------------------------------------------------------------- users */

export const isValidUserInfo = (value) =>
  Array.isArray(value) && value.length > 0 && typeof value[0]?.handle === 'string';

export const fetchUserInfo = async (handle) => {
  const result = await callCodeforces(
    'user.info',
    { handles: handle },
    { source: SOURCES.CODEFORCES_PROFILE, label: 'codeforces:user.info' },
  );

  if (!isValidUserInfo(result)) {
    throw ApiError.badGateway('Codeforces user.info response shape changed');
  }

  return result[0];
};

export const fetchUserRating = async (handle) => {
  const result = await callCodeforces(
    'user.rating',
    { handle },
    { source: SOURCES.CODEFORCES_PROFILE, label: 'codeforces:user.rating' },
  );

  // An unrated user legitimately returns [].
  if (!Array.isArray(result)) {
    throw ApiError.badGateway('Codeforces user.rating response shape changed');
  }

  return result;
};

/**
 * Submission history. `count` is capped because the full history of a very
 * active user is enormous and we only need recent-ish signal for scoring.
 */
export const fetchUserStatus = async (handle, { from = 1, count = 4000 } = {}) => {
  const result = await callCodeforces(
    'user.status',
    { handle, from, count },
    { source: SOURCES.CODEFORCES_PROFILE, label: 'codeforces:user.status' },
  );

  if (!Array.isArray(result)) {
    throw ApiError.badGateway('Codeforces user.status response shape changed');
  }

  return result;
};

/* ------------------------------------------------------------------ helpers */

/** "Codeforces Round 900 (Div. 2)" -> 2 ; "Div. 1 + Div. 2" -> 1 */
export const parseDivision = (contestName = '') => {
  const match = /div\.?\s*([1-4])/i.exec(contestName);
  return match ? Number(match[1]) : null;
};

/** Stable public id for a Codeforces problem: "1547B". */
export const problemExternalId = (problem) =>
  `${problem.contestId ?? problem.problemsetName ?? 'X'}${problem.index ?? ''}`;

export const problemUrl = (problem) =>
  problem.contestId
    ? `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
    : `https://codeforces.com/problemset`;

/** Rough Easy/Medium/Hard band so Codeforces and LeetCode stay comparable. */
export const ratingToDifficulty = (rating) => {
  if (!Number.isFinite(rating)) return null;
  if (rating < 1400) return 'Easy';
  if (rating < 1900) return 'Medium';
  return 'Hard';
};

export default {
  fetchProblemset,
  fetchContestList,
  fetchUserInfo,
  fetchUserRating,
  fetchUserStatus,
  parseDivision,
  problemExternalId,
  problemUrl,
  ratingToDifficulty,
};
