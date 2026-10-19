import { Router } from 'express';
import { z } from 'zod';

import { MAX_HANDLE_LENGTH, PLATFORMS, RECOMMENDER } from '../config/constants.js';
import { ALL_TOPIC_KEYS } from '../config/taxonomy.js';
import { history, list } from '../controllers/recommendation.controller.js';
import authenticate, { optionalAuth } from '../middleware/authenticate.js';
import { externalFetchLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';

const handle = z
  .string()
  .trim()
  .min(1)
  .max(MAX_HANDLE_LENGTH)
  .regex(/^[a-zA-Z0-9_.-]+$/)
  .optional();

const topicList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [];
    const list = Array.isArray(value) ? value : value.split(',');
    return list.map((item) => item.trim()).filter(Boolean);
  })
  .pipe(z.array(z.enum(ALL_TOPIC_KEYS)));

const recommendationQuery = z.object({
  topics: topicList,
  count: z.coerce.number().int().min(1).max(RECOMMENDER.MAX_COUNT).default(RECOMMENDER.DEFAULT_COUNT),
  /** Rating offset above the user's level; defaults to +100..+200. */
  difficultyOffset: z.coerce.number().int().min(-300).max(800).optional(),
  platform: z.enum([PLATFORMS.CODEFORCES, PLATFORMS.LEETCODE]).default(PLATFORMS.CODEFORCES),
  shuffle: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1'),
  codeforces: handle,
  leetcode: handle,
  codechef: handle,
});

const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const router = Router();

router.get('/history', authenticate, validate({ query: historyQuery }), history);
router.get('/', optionalAuth, externalFetchLimiter, validate({ query: recommendationQuery }), list);

export default router;
