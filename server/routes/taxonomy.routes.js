import { Router } from 'express';

import { CANONICAL_TOPICS, OTHER_TOPIC } from '../config/taxonomy.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

const serialise = (topic) => ({
  key: topic.key,
  name: topic.name,
  short: topic.short,
  accent: topic.accent,
  description: topic.description,
});

/**
 * GET /api/taxonomy
 * The client renders chips, radar axes and charts from this, so both halves of
 * the app always agree on the topic vocabulary.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      topics: CANONICAL_TOPICS.map(serialise),
      other: serialise(OTHER_TOPIC),
      count: CANONICAL_TOPICS.length,
    });
  }),
);

export default router;
