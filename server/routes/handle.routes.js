import { Router } from 'express';
import { z } from 'zod';

import { PLATFORM_LIST, MAX_HANDLE_LENGTH } from '../config/constants.js';
import { link, list, unlink } from '../controllers/handle.controller.js';
import authenticate from '../middleware/authenticate.js';
import { externalFetchLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';

const platformParams = z.object({ platform: z.enum(PLATFORM_LIST) });

const handleBody = z.object({
  handle: z
    .string()
    .trim()
    .min(1, 'Enter your handle')
    .max(MAX_HANDLE_LENGTH, 'That handle is too long')
    // Platform handles are conservative: letters, digits, _ . - only.
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Handles can contain letters, numbers, dots, dashes and underscores'),
});

const router = Router();

router.use(authenticate);

router.get('/', list);
router.put(
  '/:platform',
  externalFetchLimiter,
  validate({ params: platformParams, body: handleBody }),
  link,
);
router.delete('/:platform', validate({ params: platformParams }), unlink);

export default router;
