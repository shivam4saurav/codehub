import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import env from '../config/env.js';

export const ACCESS_COOKIE = 'ch_access';
export const REFRESH_COOKIE = 'ch_refresh';

/** "15m" | "30d" | "900" -> milliseconds */
export const parseDuration = (value, fallbackMs) => {
  if (typeof value === 'number') return value * 1000;

  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value).trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';

  const multipliers = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] ?? 1000);
};

export const accessTokenTtlMs = () => parseDuration(env.JWT_ACCESS_TTL, 15 * 60_000);
export const refreshTokenTtlMs = () => parseDuration(env.JWT_REFRESH_TTL, 30 * 86_400_000);

export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id ?? user._id.toString(), username: user.username }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'codehub',
    audience: 'codehub-client',
  });

/**
 * Refresh tokens carry a random jti. Only the SHA-256 of the signed token is
 * stored on the user document, so a database leak cannot be replayed as a
 * session, and logout can revoke a single device.
 */
export const signRefreshToken = (user) => {
  const jti = crypto.randomUUID();

  const token = jwt.sign(
    { sub: user.id ?? user._id.toString(), jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL, issuer: 'codehub', audience: 'codehub-client' },
  );

  return { token, jti };
};

export const verifyAccessToken = (token) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'codehub', audience: 'codehub-client' });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'codehub', audience: 'codehub-client' });

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const cookieBase = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), maxAge: accessTokenTtlMs() });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: refreshTokenTtlMs(),
    // The refresh cookie is only ever sent to the auth endpoints.
    path: '/api/auth',
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase() });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/auth' });
};

export default {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
};
