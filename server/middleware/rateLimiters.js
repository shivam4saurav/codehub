import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import env from '../config/env.js';

const handler = (message) => (req, res) => {
  res.status(429).json({ error: { message, code: 'RATE_LIMITED' } });
};

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Limits get in the way of tests; the behaviour itself is not what we test.
  skip: () => env.isTest,
};

/** Broad protection for the whole API surface. */
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
  handler: handler('Too many requests. Please slow down and try again shortly.'),
});

/** Credential endpoints: brute-force resistance. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 12,
  skipSuccessfulRequests: true,
  handler: handler('Too many attempts. Please wait a few minutes before trying again.'),
});

/** Registration is cheap to abuse, so keep it tighter than login. */
export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 8,
  handler: handler('Too many accounts created from this network. Try again later.'),
});

/** Endpoints that hit third-party APIs - keyed per user when signed in. */
export const externalFetchLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req, res) => req.user?.id ?? ipKeyGenerator(req, res),
  handler: handler('You are refreshing platform data too quickly. Give it a minute.'),
});

/** Server-rendered share card images are the most expensive route we expose. */
export const shareCardLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 20,
  handler: handler('Share card is busy. Try again in a moment.'),
});

export default globalLimiter;
