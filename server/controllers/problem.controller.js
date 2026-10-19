import { PLATFORMS } from '../config/constants.js';
import { getHandleMap } from '../services/handle.service.js';
import {
  getBookmarkMap,
  getFacets,
  getRawTagCounts,
  getTopicProgress,
  listBookmarkedProblems,
  listProblems,
  removeBookmark,
  upsertBookmark,
} from '../services/problem.service.js';
import { syncAllProblems } from '../services/problemSync.service.js';
import { buildStatusMap, getCodeforcesActivity } from '../services/userActivity.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

/**
 * Resolve which Codeforces handle to overlay solve status with:
 * an explicit ?handle= (guest preview) wins, otherwise the linked handle.
 */
const resolveCodeforcesHandle = async (req, explicitHandle) => {
  if (explicitHandle) return explicitHandle;
  if (!req.user) return null;

  const handles = await getHandleMap(req.user._id);
  return handles[PLATFORMS.CODEFORCES] ?? null;
};

/**
 * Load solve status without ever failing the request: if the platform is down
 * and there is no snapshot, the browser simply renders without status marks.
 */
const loadStatus = async (handle) => {
  if (!handle) return { statusMap: null, meta: null };

  try {
    const activity = await getCodeforcesActivity(handle);

    return {
      statusMap: buildStatusMap(activity.data),
      meta: {
        handle,
        stale: activity.stale,
        fetchedAt: activity.fetchedAt,
        source: activity.source,
        staleReason: activity.staleReason,
      },
    };
  } catch (error) {
    logger.warn('Solve status unavailable for problem list', { handle, reason: error.message });
    return {
      statusMap: null,
      meta: { handle, unavailable: true, reason: error.message },
    };
  }
};

/** GET /api/problems */
export const list = asyncHandler(async (req, res) => {
  const params = req.validated.query;

  const handle = await resolveCodeforcesHandle(req, params.handle);
  const { statusMap, meta } = await loadStatus(handle);

  // Status filtering needs the solved id list inside the Mongo query.
  const solvedIds = statusMap
    ? [...statusMap.entries()].filter(([, status]) => status === 'solved').map(([id]) => id)
    : null;

  const attemptedIds = statusMap
    ? [...statusMap.entries()].filter(([, status]) => status === 'attempted').map(([id]) => id)
    : null;

  if (params.status !== 'all' && !statusMap) {
    throw ApiError.badRequest(
      'Filtering by solve status needs a linked Codeforces handle (or a ?handle= value).',
      { code: 'HANDLE_REQUIRED' },
    );
  }

  const queryParams = { ...params, solvedIds, statusFilter: params.status };

  // "attempted" is a positive match on the attempted set.
  if (params.status === 'attempted') {
    queryParams.solvedIds = attemptedIds;
    queryParams.statusFilter = 'solved';
  }

  const result = await listProblems(queryParams);

  const bookmarks = req.user
    ? await getBookmarkMap(
        req.user._id,
        result.items.map((item) => item.id),
      )
    : new Map();

  const items = result.items.map((item) => {
    const bookmark = bookmarks.get(item.id);

    return {
      ...item,
      userStatus: statusMap ? (statusMap.get(item.externalId) ?? 'unsolved') : null,
      bookmark: bookmark
        ? { bookmarked: bookmark.bookmarked, done: bookmark.done, note: bookmark.note ?? '' }
        : null,
    };
  });

  res.json({
    items,
    pagination: result.pagination,
    status: meta,
    appliedFilters: {
      platform: params.platform ?? null,
      topics: params.topics,
      rawTags: params.rawTags,
      ratingMin: params.ratingMin ?? null,
      ratingMax: params.ratingMax ?? null,
      divisions: params.divisions,
      difficulties: params.difficulties,
      search: params.search ?? '',
      solveStatus: params.status,
      sort: params.sort,
    },
  });
});

/** GET /api/problems/facets - topic counts, rating bounds, divisions. */
export const facets = asyncHandler(async (req, res) => {
  const data = await getFacets(req.validated.query);
  res.json(data);
});

/** GET /api/problems/raw-tags - the "raw platform tags" toggle. */
export const rawTags = asyncHandler(async (req, res) => {
  const tags = await getRawTagCounts(req.validated.query);
  res.json({ platform: req.validated.query.platform, tags });
});

/** GET /api/problems/progress - topic-wise progress bars. */
export const progress = asyncHandler(async (req, res) => {
  const { platform, handle: explicitHandle } = req.validated.query;

  const handle = await resolveCodeforcesHandle(req, explicitHandle);
  const { statusMap, meta } = await loadStatus(handle);

  const topics = await getTopicProgress({ platform, statusMap });

  res.json({
    platform,
    topics,
    status: meta,
    totals: {
      problems: topics.reduce((sum, topic) => sum + topic.count, 0),
      solved: topics.reduce((sum, topic) => sum + topic.solved, 0),
    },
  });
});

/** POST /api/problems/sync - manual refresh (rate limited, signed in). */
export const sync = asyncHandler(async (req, res) => {
  const results = await syncAllProblems();
  const anyOk = results.some((result) => result.ok);

  res.status(anyOk ? 200 : 502).json({ results });
});

/* ---------------------------------------------------------------- bookmarks */

/** GET /api/problems/bookmarks */
export const listBookmarks = asyncHandler(async (req, res) => {
  const data = await listBookmarkedProblems(req.user._id, req.validated.query);
  res.json(data);
});

/** PATCH /api/problems/:problemId/bookmark */
export const updateBookmark = asyncHandler(async (req, res) => {
  const { problemId } = req.validated.params;

  const saved = await upsertBookmark(req.user._id, problemId, req.validated.body);
  if (!saved) throw ApiError.notFound('Problem not found');

  res.json({ bookmark: saved.toSafeJSON() });
});

/** DELETE /api/problems/:problemId/bookmark */
export const deleteBookmark = asyncHandler(async (req, res) => {
  const { problemId } = req.validated.params;

  const removed = await removeBookmark(req.user._id, problemId);
  if (!removed) throw ApiError.notFound('That problem was not bookmarked');

  res.json({ success: true });
});

export default { list, facets, rawTags, progress, sync, listBookmarks, updateBookmark, deleteBookmark };
