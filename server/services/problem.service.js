import { CACHE_TTL, PLATFORMS } from '../config/constants.js';
import { CANONICAL_TOPICS, OTHER_TOPIC, OTHER_TOPIC_KEY } from '../config/taxonomy.js';
import BookmarkNote from '../models/BookmarkNote.js';
import Problem from '../models/Problem.js';
import cache from '../utils/cache.js';

/**
 * Read model for the problem browser.
 * Filtering, sorting and pagination all happen in MongoDB; the user-specific
 * layer (solved status, bookmarks, notes) is merged on top afterwards.
 */

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  'rating-asc': { rating: 1, solvedCount: -1 },
  'rating-desc': { rating: -1, solvedCount: -1 },
  popularity: { solvedCount: -1 },
  newest: { contestId: -1, index: 1 },
  oldest: { contestId: 1, index: 1 },
  name: { name: 1 },
};

export const SORT_KEYS = Object.keys(SORTS);

/** Turn validated query params into a Mongo filter document. */
export const buildProblemFilter = ({
  platform,
  topics = [],
  rawTags = [],
  ratingMin,
  ratingMax,
  includeUnrated = true,
  minSolvedCount,
  divisions = [],
  difficulties = [],
  search,
  excludePremium = false,
  solvedIds = null,
  statusFilter = 'all',
}) => {
  const filter = {};

  if (platform) filter.platform = platform;
  if (topics.length > 0) filter.canonicalTopics = { $in: topics };
  if (rawTags.length > 0) filter.rawTags = { $all: rawTags };
  if (divisions.length > 0) filter.division = { $in: divisions };
  if (difficulties.length > 0) filter.difficulty = { $in: difficulties };
  if (excludePremium) filter.isPremium = { $ne: true };

  if (Number.isFinite(minSolvedCount) && minSolvedCount > 0) {
    filter.solvedCount = { $gte: minSolvedCount };
  }

  const hasMin = Number.isFinite(ratingMin);
  const hasMax = Number.isFinite(ratingMax);

  if (hasMin || hasMax) {
    const range = {};
    if (hasMin) range.$gte = ratingMin;
    if (hasMax) range.$lte = ratingMax;

    // Unrated problems (rating: null) would be excluded by a range query, so
    // they are re-admitted explicitly unless the user opts out.
    filter.$and = [...(filter.$and ?? []), includeUnrated ? { $or: [{ rating: range }, { rating: null }] } : { rating: range }];
  } else if (!includeUnrated) {
    filter.rating = { $ne: null };
  }

  if (search) {
    const term = search.trim();

    if (term) {
      const escaped = escapeRegex(term);
      // Digit-led terms are problem ids ("1547B"), everything else is a name.
      const isIdLike = /^\d/.test(term);

      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: isIdLike
            ? [
                { externalId: new RegExp(`^${escaped}`, 'i') },
                { name: new RegExp(escaped, 'i') },
              ]
            : [
                { name: new RegExp(escaped, 'i') },
                { externalId: new RegExp(`^${escaped}`, 'i') },
              ],
        },
      ];
    }
  }

  // Solve-status filtering needs the caller's solved id list.
  if (solvedIds && statusFilter !== 'all') {
    const ids = [...solvedIds];

    if (statusFilter === 'solved') filter.externalId = { $in: ids };
    if (statusFilter === 'unsolved') filter.externalId = { $nin: ids };
  }

  return filter;
};

/**
 * Paginated problem list.
 * @param {object} params validated query params
 * @param {{statusMap?: Map<string,string>, bookmarks?: Map<string,object>}} [overlay]
 */
export const listProblems = async (params, overlay = {}) => {
  const { page = 1, limit = 25, sort = 'rating-asc' } = params;

  const filter = buildProblemFilter(params);
  const skip = (page - 1) * limit;

  const [documents, total] = await Promise.all([
    Problem.find(filter)
      .sort(SORTS[sort] ?? SORTS['rating-asc'])
      .skip(skip)
      .limit(limit)
      .lean(),
    Problem.countDocuments(filter),
  ]);

  const { statusMap, bookmarks } = overlay;

  const items = documents.map((document) => {
    const bookmark = bookmarks?.get(String(document._id));

    return {
      id: String(document._id),
      platform: document.platform,
      externalId: document.externalId,
      name: document.name,
      url: document.url,
      rawTags: document.rawTags ?? [],
      canonicalTopics: document.canonicalTopics ?? [],
      rating: document.rating ?? null,
      difficulty: document.difficulty ?? null,
      solvedCount: document.solvedCount ?? 0,
      acceptanceRate: document.acceptanceRate ?? null,
      isPremium: Boolean(document.isPremium),
      contestId: document.contestId ?? null,
      contestName: document.contestName ?? '',
      index: document.index ?? '',
      division: document.division ?? null,
      // null when no handle is linked, so the UI can hide the column entirely.
      userStatus: statusMap ? (statusMap.get(document.externalId) ?? 'unsolved') : null,
      bookmark: bookmark
        ? { bookmarked: bookmark.bookmarked, done: bookmark.done, note: bookmark.note ?? '' }
        : null,
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: skip + items.length < total,
      hasPrevious: page > 1,
    },
  };
};

/**
 * Topic counts, rating bounds and divisions for the sidebar and filters.
 * Cached because it aggregates the whole collection.
 */
export const getFacets = async ({ platform } = {}) => {
  const cacheKey = `problems:facets:${platform ?? 'all'}`;

  return cache.wrap(cacheKey, CACHE_TTL.FACETS, async () => {
    const match = platform ? { platform } : {};

    const [topicRows, ratingRow, divisionRows, platformRows] = await Promise.all([
      Problem.aggregate([
        { $match: match },
        { $unwind: '$canonicalTopics' },
        { $group: { _id: '$canonicalTopics', count: { $sum: 1 } } },
      ]),
      Problem.aggregate([
        { $match: { ...match, rating: { $ne: null } } },
        {
          $group: {
            _id: null,
            min: { $min: '$rating' },
            max: { $max: '$rating' },
            rated: { $sum: 1 },
          },
        },
      ]),
      Problem.aggregate([
        { $match: { ...match, division: { $ne: null } } },
        { $group: { _id: '$division', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Problem.aggregate([{ $group: { _id: '$platform', count: { $sum: 1 } } }]),
    ]);

    const counts = new Map(topicRows.map((row) => [row._id, row.count]));

    const topics = [...CANONICAL_TOPICS, OTHER_TOPIC]
      .map((topic) => ({
        key: topic.key,
        name: topic.name,
        short: topic.short,
        accent: topic.accent,
        description: topic.description,
        count: counts.get(topic.key) ?? 0,
      }))
      // Keep "Other" last, everything else by volume.
      .sort((a, b) => {
        if (a.key === OTHER_TOPIC_KEY) return 1;
        if (b.key === OTHER_TOPIC_KEY) return -1;
        return b.count - a.count;
      });

    return {
      topics,
      rating: {
        min: ratingRow[0]?.min ?? 800,
        max: ratingRow[0]?.max ?? 3500,
        ratedCount: ratingRow[0]?.rated ?? 0,
      },
      divisions: divisionRows.map((row) => ({ division: row._id, count: row.count })),
      platforms: platformRows.map((row) => ({ platform: row._id, count: row.count })),
      total: platformRows.reduce((sum, row) => sum + row.count, 0),
    };
  });
};

/** Raw platform tags with counts, for the "raw tags" toggle. */
export const getRawTagCounts = async ({ platform = PLATFORMS.CODEFORCES, limit = 80 } = {}) => {
  const cacheKey = `problems:rawtags:${platform}:${limit}`;

  return cache.wrap(cacheKey, CACHE_TTL.FACETS, async () => {
    const rows = await Problem.aggregate([
      { $match: { platform } },
      { $unwind: '$rawTags' },
      { $group: { _id: '$rawTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return rows.map((row) => ({ tag: row._id, count: row.count }));
  });
};

/**
 * Per-topic progress: how many problems exist vs how many the user solved.
 * `statusMap` comes from the user's platform activity.
 */
export const getTopicProgress = async ({ platform, statusMap }) => {
  const facets = await getFacets({ platform });

  if (!statusMap) {
    return facets.topics.map((topic) => ({ ...topic, solved: 0, attempted: 0, percent: 0 }));
  }

  // Which topics do the user's solved/attempted problems belong to?
  const solvedIds = [];
  const attemptedIds = [];

  for (const [externalId, status] of statusMap.entries()) {
    if (status === 'solved') solvedIds.push(externalId);
    else if (status === 'attempted') attemptedIds.push(externalId);
  }

  const rows = await Problem.aggregate([
    {
      $match: {
        ...(platform ? { platform } : {}),
        externalId: { $in: [...solvedIds, ...attemptedIds] },
      },
    },
    { $project: { externalId: 1, canonicalTopics: 1 } },
    { $unwind: '$canonicalTopics' },
    {
      $group: {
        _id: '$canonicalTopics',
        ids: { $addToSet: '$externalId' },
      },
    },
  ]);

  const solvedSet = new Set(solvedIds);
  const byTopic = new Map(
    rows.map((row) => {
      let solved = 0;
      let attempted = 0;

      for (const id of row.ids) {
        if (solvedSet.has(id)) solved += 1;
        else attempted += 1;
      }

      return [row._id, { solved, attempted }];
    }),
  );

  return facets.topics.map((topic) => {
    const progress = byTopic.get(topic.key) ?? { solved: 0, attempted: 0 };

    return {
      ...topic,
      solved: progress.solved,
      attempted: progress.attempted,
      percent: topic.count > 0 ? Math.round((progress.solved / topic.count) * 1000) / 10 : 0,
    };
  });
};

/* ----------------------------------------------------------- bookmarks/notes */

/** Bookmarks for the given problems, keyed by problem id. */
export const getBookmarkMap = async (userId, problemIds) => {
  if (!userId || problemIds.length === 0) return new Map();

  const rows = await BookmarkNote.find({ userId, problemId: { $in: problemIds } }).lean();
  return new Map(rows.map((row) => [String(row.problemId), row]));
};

export const upsertBookmark = async (userId, problemId, patch) => {
  const problem = await Problem.findById(problemId).lean();
  if (!problem) return null;

  const update = {
    $set: {
      ...(patch.bookmarked !== undefined ? { bookmarked: patch.bookmarked } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.done !== undefined ? { done: patch.done, doneAt: patch.done ? new Date() : null } : {}),
    },
    $setOnInsert: {
      userId,
      problemId,
      platform: problem.platform,
      externalId: problem.externalId,
    },
  };

  return BookmarkNote.findOneAndUpdate({ userId, problemId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
};

export const removeBookmark = (userId, problemId) =>
  BookmarkNote.findOneAndDelete({ userId, problemId });

/** The /problems "Saved" tab: bookmarked problems with their problem data. */
export const listBookmarkedProblems = async (userId, { page = 1, limit = 25, done } = {}) => {
  const filter = { userId, bookmarked: true };
  if (done !== undefined) filter.done = done;

  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    BookmarkNote.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('problemId')
      .lean(),
    BookmarkNote.countDocuments(filter),
  ]);

  const items = rows
    .filter((row) => row.problemId)
    .map((row) => ({
      id: String(row.problemId._id),
      platform: row.problemId.platform,
      externalId: row.problemId.externalId,
      name: row.problemId.name,
      url: row.problemId.url,
      rating: row.problemId.rating ?? null,
      difficulty: row.problemId.difficulty ?? null,
      canonicalTopics: row.problemId.canonicalTopics ?? [],
      rawTags: row.problemId.rawTags ?? [],
      solvedCount: row.problemId.solvedCount ?? 0,
      bookmark: { bookmarked: row.bookmarked, done: row.done, note: row.note ?? '' },
      updatedAt: row.updatedAt,
    }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: skip + items.length < total,
      hasPrevious: page > 1,
    },
  };
};

export default listProblems;
