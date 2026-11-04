/**
 * Made-up profile data for the landing page preview and the /example pages.
 *
 * SAMPLE_PUBLIC_PROFILE has the same shape as GET /api/public/:username, so
 * the example pages render through exactly the same components as real
 * public profiles.
 */

export const SAMPLE = {
  name: 'Shivam Saurav',
  username: 'shivam4saurav',
  bio: 'CS undergrad · learning DP the hard way',
  location: 'India',
  school: 'Example Institute of Technology',
  totalSolved: 642,
  activeDays: 214,
  contests: 38,
  maxStreak: 41,
  currentStreak: 9,
  totalSubmissions: 1284,
  platforms: [
    { key: 'codeforces', handle: 'shivam4saurav', solved: 318, rating: 1487 },
    { key: 'leetcode', handle: 'shivam4saurav', solved: 276, rating: 1712 },
    { key: 'codechef', handle: 'shivam4saurav', solved: 48, rating: 1604 },
  ],
  difficulty: [
    { label: 'Easy', value: 248, color: '#22c55e' },
    { label: 'Medium', value: 291, color: '#f59e0b' },
    { label: 'Hard', value: 103, color: '#ef4444' },
  ],
  topics: [
    { topicKey: 'dp', name: 'Dynamic Programming', short: 'DP', accent: '#f97316', solved: 96, score: 71 },
    { topicKey: 'graphs', name: 'Graphs', short: 'Graphs', accent: '#38bdf8', solved: 81, score: 64 },
    { topicKey: 'binary-search', name: 'Binary Search', short: 'Binary search', accent: '#a78bfa', solved: 64, score: 58 },
    { topicKey: 'greedy', name: 'Greedy', short: 'Greedy', accent: '#fcd34d', solved: 59, score: 52 },
    { topicKey: 'trees', name: 'Trees', short: 'Trees', accent: '#34d399', solved: 47, score: 45 },
  ],
};

// A gentle climb with a few dips, like a real rating history.
export const SAMPLE_RATING_HISTORY = [
  1180, 1236, 1214, 1268, 1301, 1289, 1335, 1362, 1340, 1391, 1418, 1402, 1446, 1487,
].map((newRating, index) => ({ newRating, contestName: `Example round ${index + 1}` }));

export const HEATMAP_WEEKS = 24;

/** Deterministic pseudo-random activity levels (0-4), oldest week first. Built once. */
export const SAMPLE_HEATMAP = (() => {
  let seed = 7;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: HEATMAP_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, () => {
      // Later weeks are busier, so the grid "warms up" left to right.
      const roll = next() + week / HEATMAP_WEEKS / 2.5;
      if (roll < 0.45) return 0;
      if (roll < 0.7) return 1;
      if (roll < 0.9) return 2;
      if (roll < 1.05) return 3;
      return 4;
    }),
  );
})();

/** The same grid as date-keyed submission counts, ending today. */
const sampleHeatmapByDate = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const counts = {};
  SAMPLE_HEATMAP.forEach((column, week) => {
    column.forEach((level, day) => {
      const offset = (HEATMAP_WEEKS - 1 - week) * 7 + (6 - day);
      const key = new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
      if (level > 0) counts[key] = level * 2 - 1;
    });
  });
  return counts;
};

const byPlatform = (field) =>
  Object.fromEntries(SAMPLE.platforms.map((entry) => [entry.key, entry[field]]));

export const SAMPLE_PUBLIC_PROFILE = {
  owner: {
    username: SAMPLE.username,
    displayName: SAMPLE.name,
    avatarUrl: null,
    bio: SAMPLE.bio,
    cardTheme: 'minimal-light',
  },
  handles: byPlatform('handle'),
  combined: {
    totalSolved: SAMPLE.totalSolved,
    solvedByPlatform: byPlatform('solved'),
    ratings: {
      codeforces: 1487,
      codeforcesMax: 1487,
      leetcode: 1712,
      codechef: 1604,
      codechefStars: 3,
    },
    contests: SAMPLE.contests,
    streaks: {
      current: SAMPLE.currentStreak,
      longest: SAMPLE.maxStreak,
      activeDays: SAMPLE.activeDays,
      totalSubmissions: SAMPLE.totalSubmissions,
    },
    heatmap: sampleHeatmapByDate(),
    topTopics: SAMPLE.topics,
  },
  empty: false,
};
