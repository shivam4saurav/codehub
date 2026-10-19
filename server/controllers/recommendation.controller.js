import { PLATFORM_LIST } from '../config/constants.js';
import { getHandleMap } from '../services/handle.service.js';
import {
  getRecommendationHistory,
  getRecommendations,
} from '../services/recommender.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Same resolution rule as the dashboard: query handles win over linked ones. */
const resolveHandles = async (req) => {
  const query = req.validated.query ?? {};

  const explicit = Object.fromEntries(
    PLATFORM_LIST.filter((platform) => query[platform]).map((platform) => [
      platform,
      query[platform],
    ]),
  );

  if (Object.keys(explicit).length > 0) return explicit;
  if (req.user) return getHandleMap(req.user._id);

  return {};
};

/** GET /api/recommendations */
export const list = asyncHandler(async (req, res) => {
  const { topics, count, difficultyOffset, platform, shuffle } = req.validated.query;

  const handles = await resolveHandles(req);

  if (Object.keys(handles).length === 0) {
    throw ApiError.badRequest(
      'Recommendations need at least one handle. Link one in Settings, or pass ?codeforces=handle.',
      { code: 'NO_HANDLES' },
    );
  }

  const result = await getRecommendations({
    userId: req.user?._id ?? null,
    handles,
    topics,
    count,
    difficultyOffset,
    platform,
    // "Shuffle" just bypasses the cached activity read for a fresh draw.
    force: false,
  });

  res.json({ ...result, shuffled: Boolean(shuffle) });
});

/** GET /api/recommendations/history */
export const history = asyncHandler(async (req, res) => {
  const items = await getRecommendationHistory(req.user._id, req.validated.query);
  res.json({ history: items });
});

export default { list, history };
