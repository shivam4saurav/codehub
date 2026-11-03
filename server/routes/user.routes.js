import { Router } from 'express';

import { deleteMe, updateMe } from '../controllers/user.controller.js';
import authenticate from '../middleware/authenticate.js';
import { accountDeletionLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import { deleteAccountSchema, updateProfileSchema } from '../validators/auth.validators.js';

const router = Router();

router.patch('/me', authenticate, validate({ body: updateProfileSchema }), updateMe);

// authenticate runs first so the limiter can key on the user, not just the IP.
router.delete(
  '/me',
  authenticate,
  accountDeletionLimiter,
  validate({ body: deleteAccountSchema }),
  deleteMe,
);

export default router;
