import { Router } from 'express';
import { z } from 'zod';

import { PLATFORM_LIST } from '../config/constants.js';
import { downloadIcs, list, sync } from '../controllers/contest.controller.js';
import authenticate from '../middleware/authenticate.js';
import { externalFetchLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';

const platformList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [];
    const list = Array.isArray(value) ? value : value.split(',');
    return list.map((item) => item.trim()).filter(Boolean);
  })
  .pipe(z.array(z.enum(PLATFORM_LIST)));

const listQuery = z
  .object({
    platforms: platformList,
    status: z.enum(['upcoming', 'running', 'past', 'all']).default('upcoming'),
    /** ISO dates, used by the month/week calendar views. */
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    minDurationHours: z.coerce.number().min(0).max(1000).optional(),
    maxDurationHours: z.coerce.number().min(0).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: '"from" must be before "to"',
    path: ['from'],
  });

const icsParams = z.object({ contestId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id') });
const icsQuery = z.object({
  reminderMinutes: z.coerce.number().int().min(0).max(1440).optional(),
});

const router = Router();

router.get('/', validate({ query: listQuery }), list);
router.post('/sync', authenticate, externalFetchLimiter, sync);
router.get('/:contestId/ics', validate({ params: icsParams, query: icsQuery }), downloadIcs);

export default router;
