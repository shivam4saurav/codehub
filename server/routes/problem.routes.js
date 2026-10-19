import { Router } from 'express';

import {
  deleteBookmark,
  facets,
  list,
  listBookmarks,
  progress,
  rawTags,
  sync,
  updateBookmark,
} from '../controllers/problem.controller.js';
import authenticate, { optionalAuth } from '../middleware/authenticate.js';
import { externalFetchLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import {
  bookmarkBodySchema,
  bookmarkParamsSchema,
  facetsSchema,
  listBookmarksSchema,
  listProblemsSchema,
  progressSchema,
  rawTagsSchema,
} from '../validators/problem.validators.js';

const router = Router();

// Static segments must be declared before any ":param" routes.
router.get('/facets', validate({ query: facetsSchema }), facets);
router.get('/raw-tags', validate({ query: rawTagsSchema }), rawTags);
router.get('/progress', optionalAuth, validate({ query: progressSchema }), progress);

router.get('/bookmarks', authenticate, validate({ query: listBookmarksSchema }), listBookmarks);

router.post('/sync', authenticate, externalFetchLimiter, sync);

// Browsing works for guests; signing in adds status marks and bookmarks.
router.get('/', optionalAuth, validate({ query: listProblemsSchema }), list);

router.patch(
  '/:problemId/bookmark',
  authenticate,
  validate({ params: bookmarkParamsSchema, body: bookmarkBodySchema }),
  updateBookmark,
);

router.delete(
  '/:problemId/bookmark',
  authenticate,
  validate({ params: bookmarkParamsSchema }),
  deleteBookmark,
);

export default router;
