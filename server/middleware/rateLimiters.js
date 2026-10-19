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

/**
 * Bucket key for a visitor's network. ipKeyGenerator takes an IP *string* and
 * groups IPv6 addresses by /56, so one machine cannot dodge the limit by
 * cycling through its own IPv6 range.
 */
export const clientIpKey = (req) => `ip:${ipKeyGenerator(req.ip ?? '')}`;

/** Signed-in users are limited per account, guests per network. */
export const userOrIpKey = (req) => (req.user?.id ? `user:${req.user.id}` : clientIpKey(req));

/**
 * Login attempts are also counted per account, whatever IP they come from.
 * Behind Vercel the server has to trust a forwarded IP header, and someone
 * calling the API directly could fake that header; this keeps one account
 * from being brute-forced by rotating fake IPs.
 */
export const loginAccountKey = (req) => {
  const identifier =
    typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
  return identifier ? `account:${identifier}` : clientIpKey(req);
};

/** Broad protection for the whole API surface. */
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
  keyGenerator: clientIpKey,
  handler: handler('Too many requests. Please slow down and try again shortly.'),
});

/** Credential endpoints: brute-force resistance per network. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 12,
  skipSuccessfulRequests: true,
  keyGenerator: clientIpKey,
  handler: handler('Too many attempts. Please wait a few minutes before trying again.'),
});

/** Failed logins per account, independent of IP. */
export const loginAccountLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: loginAccountKey,
  handler: handler('Too many failed sign-ins for this account. Please wait 15 minutes.'),
});

/** Registration is cheap to abuse, so keep it tighter than login. */
export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 8,
  keyGenerator: clientIpKey,
  handler: handler('Too many accounts created from this network. Try again later.'),
});

/** Endpoints that hit third-party APIs - keyed per user when signed in. */
export const externalFetchLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 30,
  keyGenerator: userOrIpKey,
  handler: handler('You are refreshing platform data too quickly. Give it a minute.'),
});

/** Server-rendered share card images are the most expensive route we expose. */
export const shareCardLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 20,
  keyGenerator: clientIpKey,
  handler: handler('Share card is busy. Try again in a moment.'),
});

export default globalLimiter;
