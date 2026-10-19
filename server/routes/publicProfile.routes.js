import { Router } from 'express';
import { z } from 'zod';

import { CARD_THEMES } from '../config/constants.js';
import { cardImage, publicProfile } from '../controllers/publicProfile.controller.js';
import { externalFetchLimiter, shareCardLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';

const username = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username');

/** The route is ".../:username.png", so strip the extension before validating. */
const usernameWithPng = z
  .string()
  .trim()
  .transform((value) => value.replace(/\.png$/i, ''))
  .pipe(username);

const router = Router();

router.get(
  '/public/:username',
  externalFetchLimiter,
  validate({ params: z.object({ username }) }),
  publicProfile,
);

router.get(
  '/card/:username',
  shareCardLimiter,
  validate({
    params: z.object({ username: usernameWithPng }),
    query: z.object({ theme: z.enum(CARD_THEMES).optional() }),
  }),
  cardImage,
);

export default router;
