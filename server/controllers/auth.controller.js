import env from '../config/env.js';
import {
  changePassword,
  loginUser,
  logoutUser,
  registerUser,
  rotateRefreshToken,
  signInWithGoogle,
} from '../services/auth.service.js';
import googleOAuth, { OAUTH_COOKIE } from '../services/googleOAuth.service.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from '../services/token.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import { safeRedirectPath } from '../utils/safeRedirect.js';

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await registerUser({
    ...req.validated.body,
    userAgent: req.headers['user-agent'] ?? '',
  });

  setAuthCookies(res, tokens);
  res.status(201).json({ user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await loginUser({
    ...req.validated.body,
    userAgent: req.headers['user-agent'] ?? '',
  });

  setAuthCookies(res, tokens);
  res.json({ user: user.toSafeJSON() });
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, tokens } = await rotateRefreshToken({
    refreshToken: req.cookies?.[REFRESH_COOKIE],
    userAgent: req.headers['user-agent'] ?? '',
  });

  setAuthCookies(res, tokens);
  res.json({ user: user.toSafeJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser({ refreshToken: req.cookies?.[REFRESH_COOKIE] });
  clearAuthCookies(res);
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export const updatePassword = asyncHandler(async (req, res) => {
  await changePassword({ user: req.user, ...req.validated.body });

  // Every session was revoked, so the caller must sign in again.
  clearAuthCookies(res);
  res.json({ success: true, message: 'Password updated. Please sign in again.' });
});

/* ------------------------------------------------------- Google sign-in */

/**
 * The OAuth leg is a browser navigation, not an API call, so failures end as a
 * redirect back to the sign-in page with a short reason code. The frontend maps
 * each code to a readable sentence; nothing from Google is echoed into the URL.
 */
const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  // Lax, not the configured value: the callback is a top-level GET navigation
  // from Google, which Lax allows, and Lax works even where None is blocked.
  sameSite: 'lax',
  path: '/api/auth',
};

const failOAuth = (res, reason) =>
  res.redirect(`${env.CLIENT_URL}/login?error=${encodeURIComponent(reason)}`);

export const googleStart = asyncHandler(async (req, res) => {
  if (!googleOAuth.isEnabled()) return failOAuth(res, 'google_disabled');

  const state = googleOAuth.createState();
  const { codeVerifier, codeChallenge } = googleOAuth.createPkcePair();
  const returnTo = safeRedirectPath(req.query?.next, '');

  res.cookie(OAUTH_COOKIE, googleOAuth.sealFlowState({ state, codeVerifier, returnTo }), {
    ...OAUTH_COOKIE_OPTIONS,
    maxAge: googleOAuth.OAUTH_TTL_SECONDS * 1000,
  });

  return res.redirect(googleOAuth.buildAuthUrl({ state, codeChallenge }));
});

export const googleCallback = asyncHandler(async (req, res) => {
  // The flow cookie is single-use whatever happens next.
  const sealed = req.cookies?.[OAUTH_COOKIE];
  res.clearCookie(OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS);

  if (!googleOAuth.isEnabled()) return failOAuth(res, 'google_disabled');

  // The user pressed "cancel" on Google's consent screen.
  if (req.query?.error) return failOAuth(res, 'google_denied');

  const flow = googleOAuth.openFlowState(sealed);
  if (!flow) return failOAuth(res, 'google_expired');

  const returnedState = typeof req.query?.state === 'string' ? req.query.state : '';
  // CSRF guard: the state must be the one we sealed into the cookie.
  if (!returnedState || returnedState !== flow.state) return failOAuth(res, 'google_state');

  const code = typeof req.query?.code === 'string' ? req.query.code : '';
  if (!code) return failOAuth(res, 'google_no_code');

  let profile;
  try {
    profile = await googleOAuth.exchangeCodeForProfile({ code, codeVerifier: flow.codeVerifier });
  } catch (error) {
    logger.warn('Google code exchange failed', { code: error.code ?? null });
    return failOAuth(res, 'google_exchange');
  }

  try {
    const { tokens, created } = await signInWithGoogle({
      profile,
      userAgent: req.headers['user-agent'] ?? '',
    });

    setAuthCookies(res, tokens);

    // A brand-new account has no platform usernames yet, so send it where the
    // password signup flow goes: straight to the setup screen.
    const destination = created ? '/settings?welcome=1' : flow.returnTo || '/';
    return res.redirect(`${env.CLIENT_URL}${destination}`);
  } catch (error) {
    if (error.code === 'GOOGLE_EMAIL_UNVERIFIED') return failOAuth(res, 'google_unverified');

    logger.error('Google sign-in failed', { error: error.message });
    return failOAuth(res, 'google_failed');
  }
});

export default {
  register,
  login,
  refresh,
  logout,
  me,
  updatePassword,
  googleStart,
  googleCallback,
};
