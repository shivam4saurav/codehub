import { z } from 'zod';

import { PLATFORM_LIST } from '../config/constants.js';
import { ALL_TOPIC_KEYS } from '../config/taxonomy.js';
import { SORT_KEYS } from '../services/problem.service.js';

/** Accepts "a,b" or repeated params, and drops empties. */
const csv = (schema) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return [];
      const list = Array.isArray(value) ? value : value.split(',');
      return list.map((item) => item.trim()).filter(Boolean);
    })
    .pipe(z.array(schema));

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes'].includes(value.toLowerCase());
  });

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const listProblemsSchema = z
  .object({
    platform: z.enum(PLATFORM_LIST).optional(),
    topics: csv(z.enum(ALL_TOPIC_KEYS)),
    rawTags: csv(z.string().max(60)),
    ratingMin: z.coerce.number().int().min(0).max(4000).optional(),
    ratingMax: z.coerce.number().int().min(0).max(4000).optional(),
    includeUnrated: booleanish.default(true),
    /** LeetCode has no numeric rating, so it filters by difficulty instead. */
    difficulties: csv(z.enum(['Easy', 'Medium', 'Hard'])),
    minSolvedCount: z.coerce.number().int().min(0).optional(),
    divisions: csv(z.coerce.number().int().min(1).max(4)),
    search: z.string().trim().max(120).optional(),
    excludePremium: booleanish.default(false),
    status: z.enum(['all', 'solved', 'unsolved', 'attempted']).default('all'),
    sort: z.enum(SORT_KEYS).default('rating-asc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    /** Guests can preview solve status by passing a Codeforces handle. */
    handle: z.string().trim().max(64).optional(),
  })
  .refine(
    (data) =>
      data.ratingMin === undefined ||
      data.ratingMax === undefined ||
      data.ratingMin <= data.ratingMax,
    { message: 'ratingMin must be less than or equal to ratingMax', path: ['ratingMin'] },
  );

export const facetsSchema = z.object({
  platform: z.enum(PLATFORM_LIST).optional(),
});

export const rawTagsSchema = z.object({
  platform: z.enum(PLATFORM_LIST).default('codeforces'),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});

export const progressSchema = z.object({
  platform: z.enum(PLATFORM_LIST).default('codeforces'),
  handle: z.string().trim().max(64).optional(),
});

export const bookmarkParamsSchema = z.object({ problemId: objectId });

export const bookmarkBodySchema = z
  .object({
    bookmarked: z.boolean().optional(),
    done: z.boolean().optional(),
    note: z.string().max(4000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const listBookmarksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  done: booleanish,
});

export default { listProblemsSchema, facetsSchema, rawTagsSchema, progressSchema };
