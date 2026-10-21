import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

/**
 * Google sign-in.
 *
 * Only the network is faked (a stub `global.fetch` standing in for Google), so
 * the real PKCE, state, token-exchange and profile-parsing code all run here.
 *
 * The parts that matter most:
 *  - state mismatch is rejected (CSRF);
 *  - an unverified Google email never links to an existing account;
 *  - `next` cannot be turned into an open redirect.
 */

const CLIENT_URL = 'http://localhost:5173';

process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.CLIENT_URL = CLIENT_URL;

const { default: createApp } = await import('../../app.js');
const { default: User } = await import('../../models/User.js');
const { suggestUsername } = await import('../../services/auth.service.js');

let app;
const realFetch = global.fetch;

/** Google's own wire format for the userinfo response. */
const googleProfile = (overrides = {}) => ({
  sub: '1234567890',
  email: 'ada@example.com',
  email_verified: true,
  name: 'Ada Lovelace',
  picture: 'https://example.com/ada.jpg',
  ...overrides,
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Stand in for Google's token and userinfo endpoints.
 * @returns {Array} the requests the server made, for assertions
 */
const installGoogleStub = ({ profile = googleProfile(), tokenBody, tokenStatus = 200 } = {}) => {
  const calls = [];

  global.fetch = jest.fn(async (url, options = {}) => {
    const href = String(url);
    calls.push({ href, options });

    if (href.startsWith('https://oauth2.googleapis.com/token')) {
      return json(tokenBody ?? { access_token: 'fake-access-token' }, tokenStatus);
    }
    if (href.includes('/v1/userinfo')) {
      return json(profile);
    }

    throw new Error(`unexpected fetch to ${href}`);
  });

  return calls;
};

/** Start the flow; returns the sealed cookie and the state Google would echo. */
const startFlow = async (next) => {
  const response = await request(app)
    .get('/api/auth/google')
    .query(next ? { next } : {});

  const cookie = (response.headers['set-cookie'] ?? [])
    .map((line) => line.split(';')[0])
    .find((pair) => pair.startsWith('ch_oauth='));

  const state = response.headers.location
    ? new URL(response.headers.location).searchParams.get('state')
    : null;

  return { response, cookie, state };
};

const callback = ({ state, cookie, query = {} }) => {
  const pending = request(app)
    .get('/api/auth/google/callback')
    .query({ code: 'fake-auth-code', ...(state === undefined ? {} : { state }), ...query });

  if (cookie) pending.set('Cookie', cookie);
  return pending;
};

/** Full happy-path sign-in; returns the session cookie string. */
const signInWithGoogle = async (profile) => {
  installGoogleStub(profile ? { profile } : undefined);
  const { cookie, state } = await startFlow();
  const response = await callback({ state, cookie });

  return {
    response,
    session: (response.headers['set-cookie'] ?? [])
      .map((line) => line.split(';')[0])
      .filter((pair) => pair.startsWith('ch_'))
      .join('; '),
  };
};

const registerPasswordUser = async ({ username, email, password = 'password123' }) => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password })
    .expect(201);

  return (response.headers['set-cookie'] ?? [])
    .map((line) => line.split(';')[0])
    .join('; ');
};

beforeAll(async () => {
  await startMemoryDb();
  await syncModelIndexes([User]);
  app = createApp();
});

afterEach(async () => {
  global.fetch = realFetch;
  await clearCollections();
});

afterAll(async () => {
  global.fetch = realFetch;
  await stopMemoryDb();
});

/* --------------------------------------------------------- the start leg */

describe('GET /api/auth/google', () => {
  it('redirects to Google with PKCE and a state parameter', async () => {
    const { response } = await startFlow();
    expect(response.status).toBe(302);

    const target = new URL(response.headers.location);
    expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(target.searchParams.get('client_id')).toBe('test-google-client-id');
    expect(target.searchParams.get('response_type')).toBe('code');
    expect(target.searchParams.get('code_challenge_method')).toBe('S256');
    expect(target.searchParams.get('code_challenge')).toBeTruthy();
    expect(target.searchParams.get('state')).toBeTruthy();
    expect(target.searchParams.get('redirect_uri')).toBe(`${CLIENT_URL}/api/auth/google/callback`);
  });

  it('keeps the PKCE verifier and client secret out of the Google URL', async () => {
    const { response } = await startFlow();
    expect(response.headers.location).not.toMatch(/code_verifier/);
    expect(response.headers.location).not.toMatch(/test-google-client-secret/);
  });

  it('stores the flow in an httpOnly cookie scoped to the auth routes', async () => {
    const { response } = await startFlow();
    const cookie = (response.headers['set-cookie'] ?? []).find((line) =>
      line.startsWith('ch_oauth='),
    );

    expect(cookie).toMatch(/HttpOnly/i);
    // Lax still arrives on the top-level redirect back from Google.
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
  });

  it('gives each attempt a fresh state and challenge', async () => {
    const [a, b] = [await startFlow(), await startFlow()];
    expect(a.state).not.toBe(b.state);
    expect(a.cookie).not.toBe(b.cookie);
  });
});

/* ------------------------------------------------------ the callback leg */

describe('GET /api/auth/google/callback', () => {
  it('creates the account and signs the new user in', async () => {
    const { response } = await signInWithGoogle();

    expect(response.status).toBe(302);
    // A fresh account goes to the setup screen, like password signup does.
    expect(response.headers.location).toBe(`${CLIENT_URL}/settings?welcome=1`);

    const cookies = (response.headers['set-cookie'] ?? []).join(' ');
    expect(cookies).toMatch(/ch_access=/);
    expect(cookies).toMatch(/ch_refresh=/);

    const user = await User.findOne({ googleId: '1234567890' }).select('+passwordHash');
    expect(user.email).toBe('ada@example.com');
    expect(user.username).toBe('ada');
    expect(user.displayName).toBe('Ada Lovelace');
    expect(user.avatarUrl).toBe('https://example.com/ada.jpg');
    // A Google-created account has no password at all.
    expect(user.passwordHash).toBeUndefined();
    expect(user.hasPassword).toBe(false);
  });

  it('sends the PKCE verifier and secret to Google, not the browser', async () => {
    const calls = installGoogleStub();
    const { cookie, state } = await startFlow();
    await callback({ state, cookie });

    const tokenCall = calls.find((call) => call.href.includes('/token'));
    const body = new URLSearchParams(tokenCall.options.body);

    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('fake-auth-code');
    expect(body.get('code_verifier')).toBeTruthy();
    expect(body.get('client_secret')).toBe('test-google-client-secret');
    expect(body.get('redirect_uri')).toBe(`${CLIENT_URL}/api/auth/google/callback`);
  });

  it('clears the single-use flow cookie', async () => {
    const { response } = await signInWithGoogle();
    const cleared = (response.headers['set-cookie'] ?? []).find((line) =>
      line.startsWith('ch_oauth='),
    );

    expect(cleared).toMatch(/ch_oauth=;/);
  });

  it('cannot replay the same flow cookie twice', async () => {
    installGoogleStub();
    const { cookie, state } = await startFlow();
    await callback({ state, cookie }).expect(302);

    // The cookie is cleared in the browser, but a captured copy must also fail
    // once the authorization code has been spent.
    installGoogleStub({ tokenStatus: 400, tokenBody: { error: 'invalid_grant' } });
    const replay = await callback({ state, cookie });

    expect(replay.headers.location).toBe(`${CLIENT_URL}/login?error=google_exchange`);
    expect(await User.countDocuments()).toBe(1);
  });

  it('reuses the same account on a second sign-in', async () => {
    await signInWithGoogle();
    const { response } = await signInWithGoogle();

    expect(response.headers.location).toBe(`${CLIENT_URL}/`);
    expect(await User.countDocuments()).toBe(1);
  });

  it('links Google to an existing account with the same verified email', async () => {
    await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await signInWithGoogle();

    expect(await User.countDocuments()).toBe(1);

    const user = await User.findOne({ email: 'ada@example.com' }).select('+passwordHash');
    expect(user.googleId).toBe('1234567890');
    expect(user.username).toBe('ada_l');
    // Linking must not disturb the existing password.
    expect(user.hasPassword).toBe(true);
    expect(user.passwordHash).toBeTruthy();
  });

  it('refuses an unverified Google email instead of linking', async () => {
    await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });

    installGoogleStub({ profile: googleProfile({ email_verified: false }) });
    const { cookie, state } = await startFlow();
    const response = await callback({ state, cookie });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_unverified`);

    const user = await User.findOne({ email: 'ada@example.com' });
    expect(user.googleId).toBeNull();
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects a mismatched state (CSRF guard)', async () => {
    installGoogleStub();
    const { cookie } = await startFlow();
    const response = await callback({ state: 'not-the-sealed-state', cookie });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_state`);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a missing state', async () => {
    installGoogleStub();
    const { cookie } = await startFlow();
    const response = await callback({ cookie });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_state`);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a callback with no flow cookie', async () => {
    installGoogleStub();
    const { state } = await startFlow();
    const response = await callback({ state });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_expired`);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a forged flow cookie', async () => {
    installGoogleStub();
    const response = await callback({ state: 'anything', cookie: 'ch_oauth=not-a-real-token' });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_expired`);
  });

  it('reports a cancelled consent screen', async () => {
    installGoogleStub();
    const { cookie, state } = await startFlow();
    const response = await callback({ state, cookie, query: { error: 'access_denied' } });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_denied`);
    expect(await User.countDocuments()).toBe(0);
  });

  it('survives Google rejecting the code exchange', async () => {
    installGoogleStub({ tokenStatus: 400, tokenBody: { error: 'invalid_grant' } });
    const { cookie, state } = await startFlow();
    const response = await callback({ state, cookie });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_exchange`);
    expect(await User.countDocuments()).toBe(0);
  });

  it('survives a token response with no access token', async () => {
    installGoogleStub({ tokenBody: { scope: 'openid email' } });
    const { cookie, state } = await startFlow();
    const response = await callback({ state, cookie });

    expect(response.headers.location).toBe(`${CLIENT_URL}/login?error=google_exchange`);
  });

  it('never leaks the authorization code or secret into the redirect', async () => {
    installGoogleStub({ tokenStatus: 400, tokenBody: { error: 'invalid_grant' } });
    const { cookie, state } = await startFlow();
    const response = await callback({ state, cookie });

    expect(response.headers.location).not.toMatch(/fake-auth-code/);
    expect(response.headers.location).not.toMatch(/test-google-client-secret/);
  });
});

/* -------------------------------------------------------- the next= path */

describe('post-sign-in redirect', () => {
  it('honours a safe relative next path for a returning user', async () => {
    await signInWithGoogle();

    installGoogleStub();
    const { cookie, state } = await startFlow('/contests');
    const response = await callback({ state, cookie });

    expect(response.headers.location).toBe(`${CLIENT_URL}/contests`);
  });

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    'javascript:alert(1)',
    '/login',
  ])('refuses %s as a redirect target', async (hostile) => {
    await signInWithGoogle();

    installGoogleStub();
    const { cookie, state } = await startFlow(hostile);
    const response = await callback({ state, cookie });

    // Always lands back on our own origin.
    expect(response.headers.location).toBe(`${CLIENT_URL}/`);
  });
});

/* ------------------------------------------------- username generation */

describe('username generation', () => {
  it('derives a username from the email local part', async () => {
    expect(await suggestUsername('ada.lovelace@example.com', 'Ada')).toBe('adalovelace');
  });

  it('avoids collisions with existing usernames', async () => {
    await registerPasswordUser({ username: 'ada', email: 'other@example.com' });
    expect(await suggestUsername('ada@example.com', 'Ada')).toBe('ada2');
  });

  it('pads a too-short local part to meet the minimum length', async () => {
    const generated = await suggestUsername('a@example.com', '');
    expect(generated.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['Ada.Lovelace+cp@example.com', 'Ada'],
    ['a@example.com', ''],
    ['!!!@example.com', 'Ada Lovelace'],
    ['', ''],
  ])('always produces a username the validator accepts (%s)', async (email, name) => {
    const generated = await suggestUsername(email, name);
    expect(generated).toMatch(/^[a-zA-Z0-9_-]{3,30}$/);
  });
});

/* ------------------------------------------- passwords on Google accounts */

describe('passwords on Google accounts', () => {
  it('reports the available sign-in methods to the client', async () => {
    const { session } = await signInWithGoogle();
    const response = await request(app).get('/api/auth/me').set('Cookie', session).expect(200);

    expect(response.body.user.authMethods).toEqual({ password: false, google: true });
  });

  it('lets a Google-only user set a first password without a current one', async () => {
    const { session } = await signInWithGoogle();

    await request(app)
      .patch('/api/auth/password')
      .set('Cookie', session)
      .send({ newPassword: 'brandnew123' })
      .expect(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'ada@example.com', password: 'brandnew123' })
      .expect(200);

    expect(login.body.user.authMethods).toEqual({ password: true, google: true });
  });

  it('still demands the current password when one already exists', async () => {
    const session = await registerPasswordUser({ username: 'bob', email: 'bob@example.com' });

    await request(app)
      .patch('/api/auth/password')
      .set('Cookie', session)
      .send({ newPassword: 'another123' })
      .expect(400);
  });

  it('rejects a password login against a Google-only account', async () => {
    await signInWithGoogle();

    await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'ada@example.com', password: 'anything123' })
      .expect(401);
  });

  it('reports both methods for a password user who later linked Google', async () => {
    await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    const { session } = await signInWithGoogle();

    const response = await request(app).get('/api/auth/me').set('Cookie', session).expect(200);
    expect(response.body.user.authMethods).toEqual({ password: true, google: true });
  });
});

/* --------------------------------------------------------------- model */

describe('user model constraints', () => {
  it('allows many password-only accounts to coexist with a null googleId', async () => {
    // Regression: a *sparse* unique index would reject the second of these,
    // because googleId defaults to null rather than being absent.
    for (const name of ['one', 'two', 'three']) {
      await registerPasswordUser({ username: name, email: `${name}@example.com` });
    }

    expect(await User.countDocuments({ googleId: null })).toBe(3);
  });

  it('refuses a second account for the same Google id', async () => {
    await signInWithGoogle();

    await expect(
      User.create({ username: 'impostor', email: 'impostor@example.com', googleId: '1234567890' }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('requires a password when there is no Google account', async () => {
    await expect(
      User.create({ username: 'nopass', email: 'nopass@example.com' }),
    ).rejects.toThrow(/passwordHash/i);
  });

  it('treats an account written before hasPassword existed as having one', async () => {
    // Regression: accounts created before the field was added have it absent,
    // not false. Reading `hasPassword === true` told those users they had no
    // password, so Settings offered "set a password" and the server then
    // rejected the submit. Reproduced by deleting the field directly.
    const session = await registerPasswordUser({ username: 'legacy', email: 'legacy@example.com' });
    await User.collection.updateOne(
      { email: 'legacy@example.com' },
      { $unset: { hasPassword: '' } },
    );

    const stored = await User.collection.findOne({ email: 'legacy@example.com' });
    expect('hasPassword' in stored).toBe(false);

    const me = await request(app).get('/api/auth/me').set('Cookie', session).expect(200);
    expect(me.body.user.authMethods).toEqual({ password: true, google: false });

    // And the current password is still demanded, rather than 400-ing later.
    await request(app)
      .patch('/api/auth/password')
      .set('Cookie', session)
      .send({ newPassword: 'another123' })
      .expect(400);
  });

  it('repairs the mirror field when such an account changes its password', async () => {
    const session = await registerPasswordUser({ username: 'legacy2', email: 'legacy2@example.com' });
    await User.collection.updateOne(
      { email: 'legacy2@example.com' },
      { $unset: { hasPassword: '' } },
    );

    await request(app)
      .patch('/api/auth/password')
      .set('Cookie', session)
      .send({ currentPassword: 'password123', newPassword: 'another123' })
      .expect(200);

    const repaired = await User.collection.findOne({ email: 'legacy2@example.com' });
    expect(repaired.hasPassword).toBe(true);
  });

  it('never exposes the password hash or Google id in API output', async () => {
    const { session } = await signInWithGoogle();
    const me = await request(app).get('/api/auth/me').set('Cookie', session).expect(200);

    expect(me.body.user.passwordHash).toBeUndefined();
    expect(me.body.user.googleId).toBeUndefined();
    expect(JSON.stringify(me.body)).not.toMatch(/1234567890/);
  });
});
