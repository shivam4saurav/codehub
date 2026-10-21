import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Google sign-in using the OAuth 2.0 authorization code flow with PKCE.
 *
 * Why this flow rather than the Google Identity Services JavaScript button:
 *  - the client secret never leaves the server;
 *  - no third-party script runs in the browser;
 *  - the whole exchange is a plain server-to-server HTTPS call, so there is no
 *    JWT signature verification to get subtly wrong.
 *
 * The identity itself is read from Google's userinfo endpoint using the access
 * token we just obtained with our own client_id/client_secret. That response
 * comes straight from Google over TLS, so it needs no further validation.
 *
 * OPTIONAL BY DESIGN: with no credentials configured, `isEnabled()` is false
 * and the routes report that cleanly instead of failing in a confusing way.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

const REQUEST_TIMEOUT_MS = 10_000;

/** Short-lived cookie that carries the PKCE verifier and CSRF state. */
export const OAUTH_COOKIE = 'ch_oauth';
export const OAUTH_TTL_SECONDS = 600;

/** A distinct audience so a flow token can never be replayed as an access token. */
const OAUTH_AUDIENCE = 'codehub-oauth';

export const isEnabled = () => env.googleEnabled;

export const redirectUri = () => env.googleRedirectUri;

const base64Url = (buffer) => buffer.toString('base64url');

/**
 * PKCE pair. The verifier stays with us (in the sealed cookie) and only its
 * SHA-256 challenge goes to Google, so an intercepted authorization code is
 * useless without the original verifier.
 */
export const createPkcePair = () => {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
};

export const createState = () => base64Url(crypto.randomBytes(16));

/**
 * The in-flight flow is sealed into a signed token rather than server memory:
 * the free hosting tier restarts and sleeps, and an in-memory store would lose
 * every pending sign-in on each cold start.
 */
export const sealFlowState = ({ state, codeVerifier, returnTo }) =>
  jwt.sign({ state, codeVerifier, returnTo }, env.JWT_ACCESS_SECRET, {
    expiresIn: OAUTH_TTL_SECONDS,
    issuer: 'codehub',
    audience: OAUTH_AUDIENCE,
  });

export const openFlowState = (sealed) => {
  if (!sealed) return null;
  try {
    return jwt.verify(sealed, env.JWT_ACCESS_SECRET, {
      issuer: 'codehub',
      audience: OAUTH_AUDIENCE,
    });
  } catch {
    return null;
  }
};

export const buildAuthUrl = ({ state, codeChallenge }) => {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // We only need the identity once, so no refresh token is requested.
    access_type: 'online',
    // Always let the user pick which Google account to use.
    prompt: 'select_account',
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
};

const postForm = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    // Google's error bodies can contain the code/verifier; keep them out of logs.
    throw ApiError.badGateway(`Google token exchange failed (${response.status})`, {
      code: 'GOOGLE_EXCHANGE_FAILED',
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw ApiError.badGateway('Google token response was not JSON', {
      code: 'GOOGLE_EXCHANGE_FAILED',
    });
  }
};

/**
 * Swap the one-time authorization code for an access token, then read the
 * profile it unlocks.
 *
 * @returns {Promise<{googleId: string, email: string, emailVerified: boolean, name: string, picture: string}>}
 */
export const exchangeCodeForProfile = async ({ code, codeVerifier }) => {
  if (!isEnabled()) {
    throw ApiError.serviceUnavailable('Google sign-in is not configured', {
      code: 'GOOGLE_DISABLED',
    });
  }

  const tokens = await postForm(TOKEN_ENDPOINT, {
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  if (!tokens.access_token) {
    throw ApiError.badGateway('Google did not return an access token', {
      code: 'GOOGLE_EXCHANGE_FAILED',
    });
  }

  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw ApiError.badGateway(`Google profile lookup failed (${response.status})`, {
      code: 'GOOGLE_PROFILE_FAILED',
    });
  }

  const profile = await response.json();

  if (!profile.sub) {
    throw ApiError.badGateway('Google profile had no account id', {
      code: 'GOOGLE_PROFILE_FAILED',
    });
  }

  return {
    googleId: String(profile.sub),
    email: typeof profile.email === 'string' ? profile.email.toLowerCase() : '',
    // Google sends this as a boolean, but has historically used the string too.
    emailVerified: profile.email_verified === true || profile.email_verified === 'true',
    name: typeof profile.name === 'string' ? profile.name : '',
    picture: typeof profile.picture === 'string' ? profile.picture : '',
  };
};

export default {
  isEnabled,
  redirectUri,
  createPkcePair,
  createState,
  sealFlowState,
  openFlowState,
  buildAuthUrl,
  exchangeCodeForProfile,
  OAUTH_COOKIE,
  OAUTH_TTL_SECONDS,
};
