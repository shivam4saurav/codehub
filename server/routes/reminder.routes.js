import { Router } from 'express';
import { z } from 'zod';

import { REMINDER_STATUS } from '../config/constants.js';
import { create, list, remove } from '../controllers/reminder.controller.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const listQuery = z.object({
  status: z.enum(Object.values(REMINDER_STATUS)).optional(),
  upcomingOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1'),
});

const createBody = z.object({
  contestId: objectId,
  offsetKey: z.enum(['1d', '1h', '15m']),
});

const router = Router();

// Reminders are inherently personal: everything here requires a session.
router.use(authenticate);

router.get('/', validate({ query: listQuery }), list);
router.post('/', validate({ body: createBody }), create);
router.delete('/:reminderId', validate({ params: z.object({ reminderId: objectId }) }), remove);

export default router;
