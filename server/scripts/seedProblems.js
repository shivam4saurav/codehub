/**
 * Offline seed: `npm run seed --workspace=server`
 *
 * Inserts a small, realistic problem set without touching any third-party API.
 * The point is demo safety: the problem browser, filters and recommender all
 * work even with no internet connection.
 */
import { PLATFORMS } from '../config/constants.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import Problem from '../models/Problem.js';
import logger from '../utils/logger.js';
import { normalizeTags } from '../utils/normalizeTags.js';

const CODEFORCES_SEED = [
  ['4A', 'Watermelon', 800, ['math', 'brute force'], 1, 4, 620000],
  ['71A', 'Way Too Long Words', 800, ['strings'], 1, 71, 580000],
  ['231A', 'Team', 800, ['brute force', 'greedy'], 2, 231, 420000],
  ['158B', 'Taxi', 1100, ['greedy', 'implementation'], 2, 158, 260000],
  ['466C', 'Number of Ways', 1700, ['dp', 'math', 'two pointers'], 2, 466, 60000],
  ['474D', 'Flowers', 1700, ['dp'], 2, 474, 47000],
  ['455A', 'Boredom', 1500, ['dp'], 2, 455, 120000],
  ['1176B', 'Merge it!', 1200, ['greedy', 'math'], 3, 1176, 95000],
  ['1352C', 'K-th Not Divisible by n', 1200, ['binary search', 'math'], 3, 1352, 88000],
  ['702B', 'Powers of Two', 1300, ['hashing', 'math'], 2, 702, 74000],
  ['1092C', 'Prefixes and Suffixes', 1600, ['constructive algorithms', 'strings'], 2, 1092, 31000],
  ['1108B', 'Divisors of Two Integers', 1300, ['number theory', 'implementation'], 2, 1108, 42000],
  ['20C', 'Dijkstra?', 1900, ['graphs', 'shortest paths'], 2, 20, 38000],
  ['20B', 'Equation', 2000, ['math'], 2, 20, 21000],
  ['217A', 'Ice Skating', 1200, ['dsu', 'dfs and similar', 'graphs'], 2, 217, 66000],
  ['580C', 'Kefa and Park', 1500, ['dfs and similar', 'graphs', 'trees'], 2, 580, 71000],
  ['1005C', 'Summarize to the Power of Two', 1500, ['hashing', 'math'], 2, 1005, 52000],
  ['1195C', 'Basketball Exercise', 1500, ['dp'], 2, 1195, 45000],
  ['1516B', 'AGAGA XOOORRR', 1500, ['bitmasks', 'dp', 'greedy'], 2, 1516, 39000],
  ['1370D', 'Odd-Even Subsequence', 2000, ['binary search', 'dp', 'greedy'], 1, 1370, 12000],
  ['1360E', 'Polygon', 1300, ['dfs and similar', 'greedy', 'implementation'], 3, 1360, 61000],
  ['1490D', 'Permutation Transformation', 1200, ['divide and conquer', 'dfs and similar', 'trees'], 3, 1490, 57000],
  ['1462C', 'Unique Number', 1100, ['greedy', 'brute force'], 3, 1462, 78000],
  ['1443B', 'Saving the City', 1400, ['dp', 'greedy'], 2, 1443, 44000],
  ['1473B', 'String LCM', 1300, ['number theory', 'strings'], 2, 1473, 51000],
  ['1512C', 'A-B Palindrome', 1300, ['constructive algorithms', 'strings'], 2, 1512, 49000],
  ['1539C', 'Stable Groups', 1300, ['greedy', 'sortings'], 2, 1539, 43000],
  ['1582B', 'Luke is a Foodie', 1400, ['greedy', 'two pointers'], 2, 1582, 36000],
  ['1619C', 'Wrong Addition', 1300, ['implementation', 'math'], 2, 1619, 40000],
  ['1691B', 'Shoe Shuffling', 1100, ['constructive algorithms', 'greedy'], 2, 1691, 54000],
  ['1729C', 'Jumping on Tiles', 1200, ['greedy', 'sortings', 'strings'], 2, 1729, 47000],
  ['1786A2', 'Alexander and a Mysterious Sequence', 1500, ['math', 'number theory'], 2, 1786, 25000],
  ['1833D', 'Flipper', 1300, ['constructive algorithms', 'greedy'], 3, 1833, 33000],
  ['1873F', 'Money Trees', 1500, ['binary search', 'two pointers', 'data structures'], 4, 1873, 28000],
  ['1899C', 'Yarik and Array', 1200, ['dp', 'greedy'], 3, 1899, 46000],
  ['1918C', 'XOR-distance', 1400, ['bitmasks', 'greedy', 'math'], 2, 1918, 30000],
  ['1933D', 'Turtle Tenacity: Continual Mods', 1200, ['math', 'number theory', 'sortings'], 3, 1933, 41000],
  ['1965B', 'Missing Subsequence Sum', 1900, ['bitmasks', 'constructive algorithms'], 1, 1965, 9000],
  ['1997B', 'Make Three Regions', 1200, ['brute force', 'implementation'], 2, 1997, 35000],
  ['2000C', 'Numeric String Template', 1200, ['hashing', 'implementation', 'strings'], 2, 2000, 37000],
];

const LEETCODE_SEED = [
  ['two-sum', 'Two Sum', 'Easy', ['Array', 'Hash Table'], 55.2],
  ['add-two-numbers', 'Add Two Numbers', 'Medium', ['Linked List', 'Math', 'Recursion'], 45.1],
  ['longest-substring-without-repeating-characters', 'Longest Substring Without Repeating Characters', 'Medium', ['Hash Table', 'String', 'Sliding Window'], 35.8],
  ['median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', 'Hard', ['Array', 'Binary Search', 'Divide and Conquer'], 42.6],
  ['valid-parentheses', 'Valid Parentheses', 'Easy', ['String', 'Stack'], 42.0],
  ['merge-two-sorted-lists', 'Merge Two Sorted Lists', 'Easy', ['Linked List', 'Recursion'], 65.9],
  ['climbing-stairs', 'Climbing Stairs', 'Easy', ['Math', 'Dynamic Programming', 'Memoization'], 53.7],
  ['binary-tree-inorder-traversal', 'Binary Tree Inorder Traversal', 'Easy', ['Stack', 'Tree', 'Depth-First Search', 'Binary Tree'], 78.4],
  ['number-of-islands', 'Number of Islands', 'Medium', ['Array', 'Depth-First Search', 'Breadth-First Search', 'Union Find', 'Matrix'], 61.2],
  ['course-schedule', 'Course Schedule', 'Medium', ['Depth-First Search', 'Breadth-First Search', 'Graph', 'Topological Sort'], 48.3],
  ['coin-change', 'Coin Change', 'Medium', ['Array', 'Dynamic Programming', 'Breadth-First Search'], 45.7],
  ['word-break', 'Word Break', 'Medium', ['Array', 'Hash Table', 'String', 'Dynamic Programming', 'Trie', 'Memoization'], 47.1],
  ['lru-cache', 'LRU Cache', 'Medium', ['Hash Table', 'Linked List', 'Design', 'Doubly-Linked List'], 43.8],
  ['trapping-rain-water', 'Trapping Rain Water', 'Hard', ['Array', 'Two Pointers', 'Dynamic Programming', 'Stack', 'Monotonic Stack'], 64.5],
  ['kth-largest-element-in-an-array', 'Kth Largest Element in an Array', 'Medium', ['Array', 'Divide and Conquer', 'Sorting', 'Heap (Priority Queue)', 'Quickselect'], 67.8],
  ['subsets', 'Subsets', 'Medium', ['Array', 'Backtracking', 'Bit Manipulation'], 79.6],
  ['single-number', 'Single Number', 'Easy', ['Array', 'Bit Manipulation'], 74.2],
  ['count-primes', 'Count Primes', 'Medium', ['Array', 'Math', 'Enumeration', 'Number Theory'], 34.5],
  ['range-sum-query-mutable', 'Range Sum Query - Mutable', 'Medium', ['Array', 'Design', 'Binary Indexed Tree', 'Segment Tree'], 41.9],
  ['minimum-window-substring', 'Minimum Window Substring', 'Hard', ['Hash Table', 'String', 'Sliding Window'], 44.7],
];

const ratingToDifficulty = (rating) => {
  if (rating < 1400) return 'Easy';
  if (rating < 1900) return 'Medium';
  return 'Hard';
};

const difficultyToRating = (difficulty) =>
  ({ Easy: 1200, Medium: 1600, Hard: 2100 })[difficulty] ?? null;

const buildOperations = () => {
  const now = new Date();
  const operations = [];

  for (const [externalId, name, rating, tags, division, contestId, solvedCount] of CODEFORCES_SEED) {
    const { canonicalTopics, rawTags } = normalizeTags(PLATFORMS.CODEFORCES, tags);
    const index = externalId.replace(String(contestId), '');

    operations.push({
      updateOne: {
        filter: { platform: PLATFORMS.CODEFORCES, externalId },
        update: {
          $set: {
            name,
            url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
            rawTags,
            canonicalTopics,
            rating,
            difficulty: ratingToDifficulty(rating),
            solvedCount,
            contestId,
            index,
            division,
            contestName: `Codeforces Round ${contestId} (Div. ${division})`,
            sourceFetchedAt: now,
          },
          $setOnInsert: { platform: PLATFORMS.CODEFORCES, externalId },
        },
        upsert: true,
      },
    });
  }

  for (const [slug, title, difficulty, tags, acRate] of LEETCODE_SEED) {
    const { canonicalTopics, rawTags } = normalizeTags(PLATFORMS.LEETCODE, tags);

    operations.push({
      updateOne: {
        filter: { platform: PLATFORMS.LEETCODE, externalId: slug },
        update: {
          $set: {
            name: title,
            url: `https://leetcode.com/problems/${slug}/`,
            rawTags,
            canonicalTopics,
            rating: difficultyToRating(difficulty),
            difficulty,
            acceptanceRate: acRate,
            isPremium: false,
            sourceFetchedAt: now,
          },
          $setOnInsert: { platform: PLATFORMS.LEETCODE, externalId: slug },
        },
        upsert: true,
      },
    });
  }

  return operations;
};

const run = async () => {
  await connectDatabase();

  const operations = buildOperations();
  const result = await Problem.bulkWrite(operations, { ordered: false });

  logger.info('Seed complete', {
    problems: operations.length,
    inserted: result.upsertedCount,
    updated: result.modifiedCount,
  });

  await disconnectDatabase();
  process.exit(0);
};

run().catch(async (error) => {
  logger.error('Seed failed', { error: error.message });
  await disconnectDatabase();
  process.exit(1);
});
