import axios from 'axios';

import env from '../../config/env.js';
import { SOURCES } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import RequestQueue from '../../utils/requestQueue.js';
import { isTransientError, withRetry } from '../../utils/retry.js';
import { recordFailure, recordSuccess } from '../sourceHealth.service.js';

/**
 * LeetCode adapter (UNOFFICIAL).
 * ---------------------------------------------------------------------------
 * LeetCode publishes no documented public API; this talks to the same GraphQL
 * endpoint the website uses. It can change or start refusing traffic without
 * notice, which is exactly why every caller wraps it in fetchWithFallback().
 *
 * Everything LeetCode-specific stays in this file so the source can be swapped.
 */

const client = axios.create({
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // LeetCode rejects requests that do not look like they came from the site.
    Referer: 'https://leetcode.com',
    Origin: 'https://leetcode.com',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  },
});

/** Politeness queue - LeetCode is stricter about bursts than volume. */
const leetcodeQueue = new RequestQueue({ minIntervalMs: 700, name: 'leetcode' });

const graphql = async (query, variables = {}, { source, label } = {}) => {
  const startedAt = Date.now();

  const run = () =>
    leetcodeQueue.add(async () => {
      const response = await client.post(env.LEETCODE_GRAPHQL_URL, { query, variables });

      if (response.data?.errors?.length) {
        throw ApiError.badGateway(
          `LeetCode GraphQL error: ${response.data.errors[0]?.message ?? 'unknown'}`,
        );
      }

      if (!response.data?.data) {
        throw ApiError.badGateway('LeetCode returned no data payload');
      }

      return response.data.data;
    });

  try {
    const data = await withRetry(run, {
      label: label ?? 'leetcode:graphql',
      retries: 2,
      baseDelayMs: 800,
      shouldRetry: isTransientError,
    });

    if (source) recordSuccess(source, { latencyMs: Date.now() - startedAt });
    return data;
  } catch (error) {
    if (source) recordFailure(source, error);
    throw error;
  }
};

/* ------------------------------------------------------------------ problems */

const PROBLEM_LIST_QUERY = `
  query problemsetQuestionList(
    $categorySlug: String
    $limit: Int
    $skip: Int
    $filters: QuestionListFilterInput
  ) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        questionFrontendId
        title
        titleSlug
        difficulty
        acRate
        isPaidOnly
        topicTags {
          name
          slug
        }
      }
    }
  }
`;

export const isValidProblemPage = (value) =>
  Boolean(
    value &&
      Array.isArray(value.questions) &&
      typeof value.total === 'number' &&
      (value.questions.length === 0 || typeof value.questions[0]?.titleSlug === 'string'),
  );

/**
 * One page of the LeetCode problem set.
 * @param {{limit?: number, skip?: number, tagSlug?: string}} options
 */
export const fetchProblemPage = async ({ limit = 100, skip = 0, tagSlug } = {}) => {
  const data = await graphql(
    PROBLEM_LIST_QUERY,
    {
      categorySlug: '',
      limit,
      skip,
      filters: tagSlug ? { tags: [tagSlug] } : {},
    },
    { source: SOURCES.LEETCODE_PROBLEMS, label: 'leetcode:problemList' },
  );

  const page = data.problemsetQuestionList;
  if (!isValidProblemPage(page)) {
    throw ApiError.badGateway('LeetCode problem list response shape changed');
  }

  return page;
};

/* -------------------------------------------------------------------- profile */

const USER_PROFILE_QUERY = `
  query userPublicProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        realName
        userAvatar
        ranking
        reputation
        countryName
        aboutMe
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
        totalSubmissionNum {
          difficulty
          count
        }
      }
      badges {
        id
        displayName
        icon
      }
      userCalendar {
        streak
        totalActiveDays
        submissionCalendar
        activeYears
      }
      tagProblemCounts {
        advanced {
          tagName
          tagSlug
          problemsSolved
        }
        intermediate {
          tagName
          tagSlug
          problemsSolved
        }
        fundamental {
          tagName
          tagSlug
          problemsSolved
        }
      }
    }
    allQuestionsCount {
      difficulty
      count
    }
  }
`;

const USER_CONTEST_QUERY = `
  query userContestRankingInfo($username: String!) {
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
    }
    userContestRankingHistory(username: $username) {
      attended
      rating
      ranking
      trendDirection
      problemsSolved
      totalProblems
      contest {
        title
        startTime
      }
    }
  }
`;

export const isValidUserProfile = (value) =>
  Boolean(value?.matchedUser && typeof value.matchedUser.username === 'string');

/**
 * Public profile: solved counts by difficulty, badges, streak and the
 * submission calendar used for the heatmap.
 */
export const fetchUserProfile = async (username) => {
  const data = await graphql(
    USER_PROFILE_QUERY,
    { username },
    { source: SOURCES.LEETCODE_PROFILE, label: 'leetcode:userProfile' },
  );

  // LeetCode answers 200 with matchedUser: null for a handle that does not exist.
  if (!data?.matchedUser) {
    throw ApiError.notFound(`LeetCode user "${username}" was not found or is private`, {
      code: 'HANDLE_NOT_FOUND',
    });
  }

  if (!isValidUserProfile(data)) {
    throw ApiError.badGateway('LeetCode profile response shape changed');
  }

  return data;
};

/** Contest rating history. Absent for users who never entered a contest. */
export const fetchUserContestInfo = async (username) => {
  const data = await graphql(
    USER_CONTEST_QUERY,
    { username },
    { source: SOURCES.LEETCODE_PROFILE, label: 'leetcode:userContest' },
  );

  return {
    ranking: data?.userContestRanking ?? null,
    history: Array.isArray(data?.userContestRankingHistory)
      ? data.userContestRankingHistory.filter((entry) => entry?.attended)
      : [],
  };
};

/* ------------------------------------------------------------------ helpers */

export const problemUrl = (titleSlug) => `https://leetcode.com/problems/${titleSlug}/`;

/**
 * LeetCode exposes no per-problem rating. Difficulty is mapped to a rough
 * Codeforces-equivalent band so both platforms can share the recommender.
 */
export const difficultyToRating = (difficulty) =>
  ({ Easy: 1200, Medium: 1600, Hard: 2100 })[difficulty] ?? null;

export default {
  fetchProblemPage,
  fetchUserProfile,
  fetchUserContestInfo,
  problemUrl,
  difficultyToRating,
};
