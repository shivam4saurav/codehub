import crypto from 'node:crypto';

import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import {
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token.service.js';

const MAX_SESSIONS_PER_USER = 5;

const issueTokens = async (user, userAgent = '') => {
  const accessToken = signAccessToken(user);
  const { token: refreshToken } = signRefreshToken(user);

  const sessions = user.refreshSessions ?? [];
  const now = Date.now();

  const live = sessions
    .filter((session) => new Date(session.expiresAt).getTime() > now)
    .slice(-(MAX_SESSIONS_PER_USER - 1));

  live.push({
    tokenHash: hashToken(refreshToken),
    userAgent: String(userAgent).slice(0, 200),
    createdAt: new Date(),
    expiresAt: new Date(now + refreshTokenTtlMs()),
  });

  user.refreshSessions = live;
  await user.save();

  return { accessToken, refreshToken };
};

export const registerUser = async ({ username, email, password, userAgent }) => {
  const [usernameTaken, emailTaken] = await Promise.all([
    User.exists({ usernameLower: username.toLowerCase() }),
    User.exists({ email: email.toLowerCase() }),
  ]);

  if (usernameTaken) throw ApiError.conflict('That username is already taken');
  if (emailTaken) throw ApiError.conflict('An account with that email already exists');

  const user = new User({
    username,
    email,
    passwordHash: await User.hashPassword(password),
    hasPassword: true,
    displayName: username,
  });

  // refreshSessions/passwordHash are select:false, but they exist on this
  // in-memory document, so token issuing can save them directly.
  const tokens = await issueTokens(user, userAgent);

  return { user, tokens };
};

export const loginUser = async ({ identifier, password, userAgent }) => {
  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { usernameLower: identifier.toLowerCase() };

  const user = await User.findOne(query).select('+passwordHash +refreshSessions');

  // Same message for both branches: do not reveal which accounts exist.
  const invalid = ApiError.unauthorized('Incorrect email/username or password');
  if (!user) throw invalid;

  const matches = await user.verifyPassword(password);
  if (!matches) throw invalid;

  const tokens = await issueTokens(user, userAgent);
  return { user, tokens };
};

/**
 * Refresh-token rotation: the presented token is verified, matched against a
 * stored hash, then replaced. A replayed (already-rotated) token finds no
 * matching hash and is rejected.
 */
export const rotateRefreshToken = async ({ refreshToken, userAgent }) => {
  if (!refreshToken) throw ApiError.unauthorized('No session to refresh');

  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findById(payload.sub).select('+refreshSessions');
  if (!user) throw ApiError.unauthorized('Session no longer valid');

  const presentedHash = hashToken(refreshToken);
  const sessions = user.refreshSessions ?? [];
  const match = sessions.find((session) => session.tokenHash === presentedHash);

  if (!match) throw ApiError.unauthorized('Session no longer valid');

  if (new Date(match.expiresAt).getTime() <= Date.now()) {
    user.refreshSessions = sessions.filter((session) => session.tokenHash !== presentedHash);
    await user.save();
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  user.refreshSessions = sessions.filter((session) => session.tokenHash !== presentedHash);
  const tokens = await issueTokens(user, userAgent);

  return { user, tokens };
};

export const logoutUser = async ({ refreshToken }) => {
  if (!refreshToken) return;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return; // Nothing to revoke for an unreadable token.
  }

  const user = await User.findById(payload.sub).select('+refreshSessions');
  if (!user) return;

  const presentedHash = hashToken(refreshToken);
  user.refreshSessions = (user.refreshSessions ?? []).filter(
    (session) => session.tokenHash !== presentedHash,
  );
  await user.save();
};

/**
 * Change an existing password, or set the first one on a Google-created
 * account. The current password is only demanded when there is one to check:
 * a Google-only user is already proven to own the account by their session,
 * and would otherwise be locked out of ever adding a password.
 */
export const changePassword = async ({ user, currentPassword, newPassword }) => {
  const fresh = await User.findById(user._id).select('+passwordHash +refreshSessions');
  if (!fresh) throw ApiError.notFound('Account not found');

  if (fresh.passwordHash) {
    if (!currentPassword) throw ApiError.badRequest('Enter your current password');

    const matches = await fresh.verifyPassword(currentPassword);
    if (!matches) throw ApiError.badRequest('Your current password is incorrect');
  }

  fresh.passwordHash = await User.hashPassword(newPassword);
  fresh.hasPassword = true;
  // Changing a password kills every other session.
  fresh.refreshSessions = [];
  await fresh.save();

  return fresh;
};

/* ------------------------------------------------------- Google sign-in */

/**
 * Turn an email (or display name) into a free CodeHub username.
 *
 * Google has no concept of a username, but the rest of CodeHub is built on
 * one: it is the public profile URL and the login identifier.
 */
export const suggestUsername = async (email, displayName) => {
  const seed = String(email ?? '').split('@')[0] || String(displayName ?? '') || 'coder';

  let base = seed.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (base.length < 3) base = `${base}coder`;
  // Leave headroom for a numeric suffix inside the 30-character limit.
  base = base.slice(0, 24);

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}${attempt}`;
    if (!(await User.exists({ usernameLower: candidate.toLowerCase() }))) return candidate;
  }

  // Busy prefix: fall back to a random suffix instead of counting forever.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base.slice(0, 20)}${crypto.randomBytes(3).toString('hex')}`;
    if (!(await User.exists({ usernameLower: candidate.toLowerCase() }))) return candidate;
  }

  throw ApiError.conflict('Could not generate a free username for this account');
};

const isDuplicateKeyError = (error) => error?.code === 11000;

/**
 * Sign in (or sign up) with a verified Google profile.
 *
 * Three cases, in order:
 *  1. the Google account is already linked  -> sign in;
 *  2. a CodeHub account owns the same verified email -> link, then sign in;
 *  3. nothing matches -> create a new account.
 *
 * Case 2 is why `emailVerified` is mandatory. Linking on an unverified address
 * would let anyone who can set that address on a Google profile take over an
 * existing CodeHub account.
 */
export const signInWithGoogle = async ({ profile, userAgent }) => {
  const { googleId, email, emailVerified, name, picture } = profile ?? {};

  if (!googleId) throw ApiError.badRequest('Google did not identify the account');

  const linked = await User.findOne({ googleId }).select('+refreshSessions');
  if (linked) {
    // Backfill a profile picture only if the user has not chosen one.
    if (!linked.avatarUrl && picture) linked.avatarUrl = picture;
    const tokens = await issueTokens(linked, userAgent);
    return { user: linked, tokens, created: false };
  }

  if (!email || !emailVerified) {
    throw ApiError.badRequest(
      'Your Google account does not have a verified email address, so it cannot be used to sign in.',
      { code: 'GOOGLE_EMAIL_UNVERIFIED' },
    );
  }

  const existing = await User.findOne({ email }).select('+refreshSessions');
  if (existing) {
    existing.googleId = googleId;
    if (!existing.avatarUrl && picture) existing.avatarUrl = picture;

    const tokens = await issueTokens(existing, userAgent);
    return { user: existing, tokens, created: false, linkedToExisting: true };
  }

  const user = new User({
    username: await suggestUsername(email, name),
    email,
    googleId,
    hasPassword: false,
    displayName: (name || '').slice(0, 60),
    avatarUrl: picture || '',
  });

  try {
    const tokens = await issueTokens(user, userAgent);
    return { user, tokens, created: true };
  } catch (error) {
    // Two tabs finishing the same sign-in at once: the unique index wins and
    // we fall back to whichever document actually landed.
    if (!isDuplicateKeyError(error)) throw error;

    const raced = await User.findOne({ $or: [{ googleId }, { email }] }).select('+refreshSessions');
    if (!raced) throw error;

    const tokens = await issueTokens(raced, userAgent);
    return { user: raced, tokens, created: false };
  }
};

export default {
  registerUser,
  loginUser,
  rotateRefreshToken,
  logoutUser,
  changePassword,
  signInWithGoogle,
  suggestUsername,
};
