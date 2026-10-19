import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import createApp from '../../app.js';
import User from '../../models/User.js';
import { clearCollections, startMemoryDb, stopMemoryDb, syncModelIndexes } from '../helpers/memoryDb.js';

const VALID = { username: 'ada_lovelace', email: 'ada@example.com', password: 'analytical1' };

/** Extract a named cookie from a supertest response. */
const cookieNamed = (response, name) =>
  (response.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith(`${name}=`));

describe('auth flow', () => {
  let app;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([User]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);
  beforeEach(clearCollections);

  it('registers a user and sets httpOnly auth cookies', async () => {
    const response = await request(app).post('/api/auth/register').send(VALID).expect(201);

    expect(response.body.user).toMatchObject({
      username: VALID.username,
      email: VALID.email,
      publicProfile: { enabled: false },
    });

    // Password material must never leave the server.
    expect(JSON.stringify(response.body)).not.toMatch(/analytical1|passwordHash/);

    const access = cookieNamed(response, 'ch_access');
    const refresh = cookieNamed(response, 'ch_refresh');

    expect(access).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/HttpOnly/i);
    // The refresh cookie is scoped to the auth routes only.
    expect(refresh).toMatch(/Path=\/api\/auth/i);
  });

  it('stores the password as a bcrypt hash, never in plain text', async () => {
    await request(app).post('/api/auth/register').send(VALID).expect(201);

    const stored = await User.findOne({ email: VALID.email }).select('+passwordHash');

    expect(stored.passwordHash).not.toBe(VALID.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await stored.verifyPassword(VALID.password)).toBe(true);
    expect(await stored.verifyPassword('wrong-password1')).toBe(false);
  });

  it('rejects a duplicate username or email with 409', async () => {
    await request(app).post('/api/auth/register').send(VALID).expect(201);

    await request(app)
      .post('/api/auth/register')
      .send({ ...VALID, email: 'other@example.com' })
      .expect(409);

    await request(app)
      .post('/api/auth/register')
      .send({ ...VALID, username: 'someone_else' })
      .expect(409);
  });

  it('rejects weak or malformed input with field-level detail', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a b', email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const fields = response.body.error.details.map((detail) => detail.field);
    expect(fields).toEqual(
      expect.arrayContaining(['body.username', 'body.email', 'body.password']),
    );
  });

  it('signs in with either username or email', async () => {
    await request(app).post('/api/auth/register').send(VALID).expect(201);

    await request(app)
      .post('/api/auth/login')
      .send({ identifier: VALID.email, password: VALID.password })
      .expect(200);

    await request(app)
      .post('/api/auth/login')
      .send({ identifier: VALID.username, password: VALID.password })
      .expect(200);
  });

  it('does not reveal whether an account exists on a failed login', async () => {
    await request(app).post('/api/auth/register').send(VALID).expect(201);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ identifier: VALID.email, password: 'wrongpass1' })
      .expect(401);

    const noSuchUser = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'ghost@example.com', password: 'wrongpass1' })
      .expect(401);

    expect(wrongPassword.body.error.message).toBe(noSuchUser.body.error.message);
  });

  it('protects /auth/me and returns the user once authenticated', async () => {
    await request(app).get('/api/auth/me').expect(401);

    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(VALID).expect(201);

    const response = await agent.get('/api/auth/me').expect(200);
    expect(response.body.user.username).toBe(VALID.username);
  });

  it('rotates the refresh token and rejects the replayed one', async () => {
    const agent = request.agent(app);
    const registered = await agent.post('/api/auth/register').send(VALID).expect(201);
    const originalRefresh = cookieNamed(registered, 'ch_refresh');

    await agent.post('/api/auth/refresh').expect(200);

    // The agent now holds the rotated cookie; replaying the original must fail.
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalRefresh)
      .expect(401);

    expect(replay.body.error.message).toMatch(/no longer valid/i);
  });

  it('clears cookies on logout and revokes the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(VALID).expect(201);

    const response = await agent.post('/api/auth/logout').expect(200);
    const cleared = response.headers['set-cookie'].join(';');

    expect(cleared).toMatch(/ch_access=;/);
    expect(cleared).toMatch(/ch_refresh=;/);

    await agent.get('/api/auth/me').expect(401);
  });

  it('keeps public sharing disabled until the user opts in', async () => {
    const agent = request.agent(app);
    const registered = await agent.post('/api/auth/register').send(VALID).expect(201);
    expect(registered.body.user.publicProfile.enabled).toBe(false);

    const updated = await agent
      .patch('/api/users/me')
      .send({ publicProfile: { enabled: true, cardTheme: 'gradient' } })
      .expect(200);

    expect(updated.body.user.publicProfile).toMatchObject({
      enabled: true,
      cardTheme: 'gradient',
    });
  });

  it('changes the password and invalidates existing sessions', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(VALID).expect(201);

    await agent
      .patch('/api/auth/password')
      .send({ currentPassword: VALID.password, newPassword: 'newsecret99' })
      .expect(200);

    // Cookies were cleared, so the old session is gone.
    await agent.get('/api/auth/me').expect(401);

    await request(app)
      .post('/api/auth/login')
      .send({ identifier: VALID.email, password: 'newsecret99' })
      .expect(200);
  });

  it('blocks cookie-authenticated mutations from an unknown origin', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ identifier: VALID.email, password: VALID.password });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('BAD_ORIGIN');
  });
});
