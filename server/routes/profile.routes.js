import { Router } from 'express';
import { z } from 'zod';

import { MAX_HANDLE_LENGTH } from '../config/constants.js';
import { getProfile, refreshProfile } from '../controllers/profile.controller.js';
import authenticate, { optionalAuth } from '../middleware/authenticate.js';
import { externalFetchLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';

const handle = z
  .string()
  .trim()
  .min(1)
  .max(MAX_HANDLE_LENGTH)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Handles can contain letters, numbers, dots, dashes and underscores')
  .optional();

const profileQuery = z.object({
  codeforces: handle,
  leetcode: handle,
  codechef: handle,
});

const router = Router();

// Guests can view any dashboard by passing handles; signing in uses linked ones.
router.get('/', optionalAuth, externalFetchLimiter, validate({ query: profileQuery }), getProfile);
router.post('/refresh', authenticate, externalFetchLimiter, refreshProfile);

export default router;
