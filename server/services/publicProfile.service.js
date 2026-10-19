import { PLATFORM_LIST } from '../config/constants.js';
import PlatformHandle from '../models/PlatformHandle.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { buildDashboard } from './profileAggregation.service.js';

/**
 * Public profile assembly for /u/:username and the share card.
 *
 * Privacy first: a profile is only readable when the owner has explicitly
 * enabled publicProfile.enabled. Anything else answers 404 - not 403 - so the
 * endpoint does not confirm whether an account exists.
 */

export const findPublicUser = async (username) => {
  const user = await User.findOne({ usernameLower: String(username).toLowerCase() });

  if (!user || !user.publicProfile?.enabled) {
    throw ApiError.notFound('No public profile found for that username', {
      code: 'PROFILE_NOT_PUBLIC',
    });
  }

  return user;
};

/** Compact payload for the public page and the card renderer. */
export const getPublicProfile = async (username) => {
  const user = await findPublicUser(username);

  const handleRows = await PlatformHandle.find({ userId: user._id }).lean();
  const handles = Object.fromEntries(
    PLATFORM_LIST.filter((platform) => handleRows.some((row) => row.platform === platform)).map(
      (platform) => [platform, handleRows.find((row) => row.platform === platform).handle],
    ),
  );

  const owner = {
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || '',
    cardTheme: user.publicProfile?.cardTheme ?? 'dark-neon',
    // Only included when the owner opted in.
    email: user.publicProfile?.showEmail ? user.email : null,
    memberSince: user.createdAt,
  };

  if (Object.keys(handles).length === 0) {
    return {
      owner,
      handles: {},
      combined: null,
      statuses: {},
      empty: true,
    };
  }

  const dashboard = await buildDashboard({ handles, force: false });

  return {
    owner,
    handles,
    statuses: dashboard.statuses,
    combined: {
      totalSolved: dashboard.combined.totalSolved,
      solvedByPlatform: dashboard.combined.solvedByPlatform,
      ratings: dashboard.combined.ratings,
      contests: dashboard.combined.contests,
      streaks: dashboard.combined.streaks,
      heatmap: dashboard.combined.heatmap,
      topTopics: dashboard.combined.topics
        .filter((topic) => topic.solved > 0)
        .slice(0, 5)
        .map((topic) => ({
          topicKey: topic.topicKey,
          name: topic.name,
          short: topic.short,
          accent: topic.accent,
          solved: topic.solved,
          score: topic.percent,
        })),
      anyStale: dashboard.combined.anyStale,
    },
    empty: false,
  };
};

/** Reduced projection used by the PNG renderer and the OG description. */
export const getCardData = async (username) => {
  const profile = await getPublicProfile(username);

  const ratings = profile.combined?.ratings ?? {};

  return {
    username: profile.owner.username,
    displayName: profile.owner.displayName,
    avatarUrl: profile.owner.avatarUrl,
    theme: profile.owner.cardTheme,
    handles: profile.handles,
    totalSolved: profile.combined?.totalSolved ?? 0,
    contests: profile.combined?.contests ?? 0,
    streak: profile.combined?.streaks?.current ?? 0,
    ratings: {
      codeforces: ratings.codeforces ?? null,
      leetcode: ratings.leetcode ?? null,
      codechef: ratings.codechef ?? null,
      codechefStars: ratings.codechefStars ?? null,
    },
    topTopics: profile.combined?.topTopics ?? [],
    heatmap: profile.combined?.heatmap ?? {},
  };
};

/** One-line summary reused in OG/Twitter descriptions. */
export const cardDescription = (card) => {
  const parts = [`${card.totalSolved} problems solved`];

  if (card.ratings.codeforces) parts.push(`Codeforces ${card.ratings.codeforces}`);
  if (card.ratings.leetcode) parts.push(`LeetCode ${card.ratings.leetcode}`);
  if (card.ratings.codechef) parts.push(`CodeChef ${card.ratings.codechef}`);
  if (card.topTopics.length > 0) {
    parts.push(`strongest in ${card.topTopics.slice(0, 2).map((topic) => topic.name).join(' and ')}`);
  }

  return `${parts.join(' · ')}.`;
};

export default { getPublicProfile, getCardData, cardDescription };
