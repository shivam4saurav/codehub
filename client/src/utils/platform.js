/**
 * Shared platform metadata: labels, accents and profile/problem URLs.
 *
 * Accents are plain hex strings on purpose: charts build translucent variants
 * by appending an alpha byte (`${accent}28`), so these must stay #rrggbb.
 */

export const PLATFORMS = {
  codeforces: {
    key: 'codeforces',
    label: 'Codeforces',
    short: 'CF',
    accent: '#1f8acb',
    badge: 'codeforces',
    profileUrl: (handle) => `https://codeforces.com/profile/${encodeURIComponent(handle)}`,
    hasRating: true,
  },
  leetcode: {
    key: 'leetcode',
    label: 'LeetCode',
    short: 'LC',
    accent: '#ffa116',
    badge: 'leetcode',
    profileUrl: (handle) => `https://leetcode.com/u/${encodeURIComponent(handle)}/`,
    hasRating: true,
  },
  codechef: {
    key: 'codechef',
    label: 'CodeChef',
    short: 'CC',
    accent: '#b07a4f',
    badge: 'codechef',
    profileUrl: (handle) => `https://www.codechef.com/users/${encodeURIComponent(handle)}`,
    hasRating: true,
  },
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS);

export const getPlatform = (key) =>
  PLATFORMS[key] ?? {
    key,
    label: key,
    short: key?.slice(0, 2).toUpperCase() ?? '??',
    accent: '#7d786e',
    badge: 'neutral',
    profileUrl: () => '#',
    hasRating: false,
  };

export const platformLabel = (key) => getPlatform(key).label;

export const platformAccent = (key) => getPlatform(key).accent;

/**
 * Codeforces rating tiers in the colours people know from Codeforces itself,
 * nudged to mid-tones so they stay readable on both the paper and ink themes.
 */
export const ratingTier = (rating) => {
  if (rating === null || rating === undefined) return { name: 'Unrated', color: '#7d786e' };
  if (rating < 1200) return { name: 'Newbie', color: '#808080' };
  if (rating < 1400) return { name: 'Pupil', color: '#1f8b3a' };
  if (rating < 1600) return { name: 'Specialist', color: '#0f9488' };
  if (rating < 1900) return { name: 'Expert', color: '#3366cc' };
  if (rating < 2100) return { name: 'Candidate Master', color: '#9b30b0' };
  if (rating < 2300) return { name: 'Master', color: '#d97a00' };
  if (rating < 2400) return { name: 'International Master', color: '#d06000' };
  if (rating < 2600) return { name: 'Grandmaster', color: '#d42a2a' };
  if (rating < 3000) return { name: 'International Grandmaster', color: '#b81d1d' };
  return { name: 'Legendary Grandmaster', color: '#9a1414' };
};

/** LeetCode's own difficulty colours, darkened enough to read on white. */
export const difficultyColor = (difficulty) =>
  ({
    Easy: '#109a87',
    Medium: '#c27c00',
    Hard: '#d63a4d',
  })[difficulty] ?? '#7d786e';

export default PLATFORMS;
