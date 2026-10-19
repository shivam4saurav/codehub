import env from '../config/env.js';
import { PLATFORM_LIST } from '../config/constants.js';
import { getHandleMap } from '../services/handle.service.js';
import { buildDashboard } from '../services/profileAggregation.service.js';
import { invalidateProfileCache } from '../services/profile.service.js';
import { invalidateActivity } from '../services/userActivity.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Handles come from the query string for guests, or from the signed-in user's
 * linked handles. Explicit query params always win, so a logged-in user can
 * still look up someone else's public dashboard.
 */
const resolveHandles = async (req) => {
  const query = req.validated.query ?? {};

  const explicit = Object.fromEntries(
    PLATFORM_LIST.filter((platform) => query[platform]).map((platform) => [
      platform,
      query[platform],
    ]),
  );

  if (Object.keys(explicit).length > 0) return { handles: explicit, source: 'query' };

  if (req.user) {
    const linked = await getHandleMap(req.user._id);
    if (Object.keys(linked).length > 0) return { handles: linked, source: 'linked' };
  }

  return { handles: {}, source: 'none' };
};

/** GET /api/profile */
export const getProfile = asyncHandler(async (req, res) => {
  const { handles, source } = await resolveHandles(req);

  if (Object.keys(handles).length === 0) {
    throw ApiError.badRequest(
      'Add at least one handle to build a dashboard (e.g. ?codeforces=tourist).',
      { code: 'NO_HANDLES' },
    );
  }

  const dashboard = await buildDashboard({ handles, force: false });

  res.json({ ...dashboard, handleSource: source });
});

/**
 * POST /api/profile/refresh
 * Manual refresh with a per-user cooldown: third-party APIs are the scarce
 * resource here, not our own CPU.
 */
export const refreshProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const cooldownMs = env.PROFILE_REFRESH_COOLDOWN_SECONDS * 1000;
  const last = user.lastProfileRefreshAt?.getTime() ?? 0;
  const elapsed = Date.now() - last;

  if (elapsed < cooldownMs) {
    const retryAfter = Math.ceil((cooldownMs - elapsed) / 1000);

    res.set('Retry-After', String(retryAfter));
    throw ApiError.tooManyRequests(
      `Platform data was just refreshed. Try again in ${retryAfter}s.`,
      { code: 'REFRESH_COOLDOWN', details: { retryAfterSeconds: retryAfter } },
    );
  }

  const handles = await getHandleMap(user._id);
  if (Object.keys(handles).length === 0) {
    throw ApiError.badRequest('Link at least one platform handle first.', { code: 'NO_HANDLES' });
  }

  // Drop caches so the fetchers really hit the platforms.
  for (const [platform, handle] of Object.entries(handles)) {
    invalidateProfileCache(platform, handle);
    invalidateActivity(platform, handle);
  }

  const dashboard = await buildDashboard({ handles, force: true });

  user.lastProfileRefreshAt = new Date();
  await user.save();

  res.json({
    ...dashboard,
    handleSource: 'linked',
    refreshedAt: user.lastProfileRefreshAt,
    cooldownSeconds: env.PROFILE_REFRESH_COOLDOWN_SECONDS,
  });
});

export default { getProfile, refreshProfile };
