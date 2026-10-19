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

export const changePassword = async ({ user, currentPassword, newPassword }) => {
  const fresh = await User.findById(user._id).select('+passwordHash +refreshSessions');
  if (!fresh) throw ApiError.notFound('Account not found');

  const matches = await fresh.verifyPassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Your current password is incorrect');

  fresh.passwordHash = await User.hashPassword(newPassword);
  // Changing a password kills every other session.
  fresh.refreshSessions = [];
  await fresh.save();

  return fresh;
};

export default { registerUser, loginUser, rotateRefreshToken, logoutUser, changePassword };
