import User from '../models/User.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../services/token.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const readToken = (req) => {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;

  // Bearer support keeps curl/Postman usable during development.
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();

  return null;
};

const resolveUser = async (req) => {
  const token = readToken(req);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  return user ?? null;
};

/** Hard gate: 401 unless a valid access token resolves to a live user. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw ApiError.unauthorized('Please sign in to continue');

  req.user = user;
  next();
});

/**
 * Soft gate for guest-friendly routes (dashboard, problem browser).
 * Never throws: an expired or malformed token just means "guest".
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
});

export default authenticate;
