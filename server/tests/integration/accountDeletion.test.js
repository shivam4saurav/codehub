import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

/**
 * Self-service account deletion.
 *
 * What matters: a session alone is not enough (typed username, plus the
 * password when the account has one), every user-keyed collection is emptied
 * for that user only, and the old cookie stops working afterwards.
 */
const CLIENT_URL = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.CLIENT_URL = CLIENT_URL;

const { default: createApp } = await import('../../app.js');
const { default: User } = await import('../../models/User.js');
const { default: BookmarkNote } = await import('../../models/BookmarkNote.js');
const { default: PlatformHandle } = await import('../../models/PlatformHandle.js');
const { default: RecommendationHistory } = await import('../../models/RecommendationHistory.js');
const { default: Reminder } = await import('../../models/Reminder.js');

let app;
const realFetch = global.fetch;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const installGoogleStub = () => {
  global.fetch = jest.fn(async (url) => {
    const href = String(url);
    if (href.startsWith('https://oauth2.googleapis.com/token')) {
      return json({ access_token: 'fake-access-token' });
    }
    if (href.includes('/v1/userinfo')) {
      return json({
        sub: '1234567890',
        email: 'ada@example.com',
        email_verified: true,
        name: 'Ada Lovelace',
        picture: 'https://example.com/ada.jpg',
      });
    }
    throw new Error(`unexpected fetch to ${href}`);
  });
};

const sessionFrom = (response) =>
  (response.headers['set-cookie'] ?? [])
    .map((line) => line.split(';')[0])
    .filter((pair) => pair.startsWith('ch_'))
    .join('; ');

const signInWithGoogle = async () => {
  installGoogleStub();
  const start = await request(app).get('/api/auth/google');
  const flowCookie = (start.headers['set-cookie'] ?? [])
    .map((line) => line.split(';')[0])
    .find((pair) => pair.startsWith('ch_oauth='));
  const state = new URL(start.headers.location).searchParams.get('state');
  const response = await request(app)
    .get('/api/auth/google/callback')
    .query({ code: 'fake-auth-code', state })
    .set('Cookie', flowCookie);
  return sessionFrom(response);
};

const registerPasswordUser = async ({ username, email, password = 'password123' }) => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password })
    .expect(201);
  return { session: sessionFrom(response), id: response.body.user.id };
};

/** One row in every user-keyed collection. */
const seedChildren = async (userId, tag) => {
  const id = new mongoose.Types.ObjectId(userId);
  await BookmarkNote.create({
    userId: id,
    problemId: new mongoose.Types.ObjectId(),
    platform: 'codeforces',
    externalId: `${tag}-1A`,
    note: 'remember this',
  });
  await PlatformHandle.create({
    userId: id,
    platform: 'codeforces',
    handle: `${tag}_cf`,
    normalizedHandle: `${tag}_cf`,
  });
  await Reminder.create({
    userId: id,
    contestId: new mongoose.Types.ObjectId(),
    contest: {
      platform: 'codeforces',
      externalId: `${tag}-round`,
      name: 'Round',
      url: 'https://example.com/round',
      startTime: new Date(Date.now() + 86_400_000),
    },
    offsetKey: '1h',
    dueAt: new Date(Date.now() + 80_000_000),
    email: `${tag}@example.com`,
  });
  await RecommendationHistory.create({ userId: id, items: [] });
};

const countChildren = async (userId) => {
  const id = new mongoose.Types.ObjectId(userId);
  return {
    bookmarks: await BookmarkNote.countDocuments({ userId: id }),
    handles: await PlatformHandle.countDocuments({ userId: id }),
    reminders: await Reminder.countDocuments({ userId: id }),
    history: await RecommendationHistory.countDocuments({ userId: id }),
  };
};

const ALL_ONE = { bookmarks: 1, handles: 1, reminders: 1, history: 1 };
const ALL_ZERO = { bookmarks: 0, handles: 0, reminders: 0, history: 0 };

const deleteMe = (session, body) => {
  const pending = request(app).delete('/api/users/me');
  if (session) pending.set('Cookie', session);
  return pending.send(body);
};

beforeAll(async () => {
  await startMemoryDb();
  await syncModelIndexes([User, BookmarkNote, PlatformHandle, Reminder, RecommendationHistory]);
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

describe('DELETE /api/users/me', () => {
  it('deletes the user and every child row, and leaves other users alone', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    const bob = await registerPasswordUser({ username: 'bob', email: 'bob@example.com' });
    await seedChildren(ada.id, 'ada');
    await seedChildren(bob.id, 'bob');

    const response = await deleteMe(ada.session, {
      confirmUsername: 'ada_l',
      currentPassword: 'password123',
    }).expect(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.message).toBe('string');

    expect(await User.findById(ada.id)).toBeNull();
    expect(await countChildren(ada.id)).toEqual(ALL_ZERO);
    expect(await User.findById(bob.id)).not.toBeNull();
    expect(await countChildren(bob.id)).toEqual(ALL_ONE);
  });

  it('rejects a wrong password and deletes nothing', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await seedChildren(ada.id, 'ada');

    const response = await deleteMe(ada.session, {
      confirmUsername: 'ada_l',
      currentPassword: 'not-the-password1',
    }).expect(400);
    expect(response.body.error.message).toMatch(/password is incorrect/i);
    expect(await User.findById(ada.id)).not.toBeNull();
    expect(await countChildren(ada.id)).toEqual(ALL_ONE);
  });

  it('requires the password when the account has one', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await seedChildren(ada.id, 'ada');

    await deleteMe(ada.session, { confirmUsername: 'ada_l' }).expect(400);
    expect(await User.findById(ada.id)).not.toBeNull();
    expect(await countChildren(ada.id)).toEqual(ALL_ONE);
  });

  it.each([
    ['missing', {}],
    ['empty', { confirmUsername: '' }],
    ['wrong', { confirmUsername: 'someone_else' }],
    ['a partial match', { confirmUsername: 'ada' }],
  ])('rejects a %s confirmUsername and deletes nothing', async (_label, extra) => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await seedChildren(ada.id, 'ada');

    const response = await deleteMe(ada.session, { currentPassword: 'password123', ...extra });
    expect([400, 422]).toContain(response.status);
    expect(await User.findById(ada.id)).not.toBeNull();
    expect(await countChildren(ada.id)).toEqual(ALL_ONE);
  });

  it('matches the username case-insensitively', async () => {
    const ada = await registerPasswordUser({ username: 'Ada_L', email: 'ada@example.com' });
    await deleteMe(ada.session, {
      confirmUsername: 'aDA_l',
      currentPassword: 'password123',
    }).expect(200);
    expect(await User.findById(ada.id)).toBeNull();
  });

  it('deletes a Google-only account with just the typed username', async () => {
    const session = await signInWithGoogle();
    const me = await request(app).get('/api/auth/me').set('Cookie', session).expect(200);
    expect(me.body.user.authMethods.password).toBe(false);
    await seedChildren(me.body.user.id, 'ada');

    // A wrong username still stops it.
    await deleteMe(session, { confirmUsername: 'nope' }).expect(400);
    expect(await User.findById(me.body.user.id)).not.toBeNull();

    await deleteMe(session, { confirmUsername: me.body.user.username }).expect(200);
    expect(await User.findById(me.body.user.id)).toBeNull();
    expect(await countChildren(me.body.user.id)).toEqual(ALL_ZERO);
  });

  it('requires a session', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await deleteMe(null, { confirmUsername: 'ada_l', currentPassword: 'password123' }).expect(401);
    expect(await User.findById(ada.id)).not.toBeNull();
  });

  it('clears the cookies and invalidates the old session', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    const response = await deleteMe(ada.session, {
      confirmUsername: 'ada_l',
      currentPassword: 'password123',
    }).expect(200);

    const cookies = (response.headers['set-cookie'] ?? []).join(' ');
    expect(cookies).toMatch(/ch_access=;/);
    expect(cookies).toMatch(/ch_refresh=;/);

    await request(app).get('/api/auth/me').set('Cookie', ada.session).expect(401);
    await request(app).post('/api/auth/refresh').set('Cookie', ada.session).expect(401);
  });

  it('answers a repeat delete with 401, not 500', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    const body = { confirmUsername: 'ada_l', currentPassword: 'password123' };
    await deleteMe(ada.session, body).expect(200);
    await deleteMe(ada.session, body).expect(401);
  });

  it('lets Google sign-in create a brand new account with the same email', async () => {
    const firstSession = await signInWithGoogle();
    const first = await request(app).get('/api/auth/me').set('Cookie', firstSession).expect(200);
    await deleteMe(firstSession, { confirmUsername: first.body.user.username }).expect(200);

    const secondSession = await signInWithGoogle();
    const second = await request(app).get('/api/auth/me').set('Cookie', secondSession).expect(200);
    expect(second.body.user.email).toBe('ada@example.com');
    expect(second.body.user.id).not.toBe(first.body.user.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it('removes the public profile', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await request(app)
      .patch('/api/users/me')
      .set('Cookie', ada.session)
      .send({ publicProfile: { enabled: true } })
      .expect(200);
    await request(app).get('/api/public/ada_l').expect(200);

    await deleteMe(ada.session, {
      confirmUsername: 'ada_l',
      currentPassword: 'password123',
    }).expect(200);
    await request(app).get('/api/public/ada_l').expect(404);
  });

  it('treats a legacy account with no hasPassword field as having a password', async () => {
    const legacy = await registerPasswordUser({ username: 'legacy', email: 'legacy@example.com' });
    await User.collection.updateOne(
      { email: 'legacy@example.com' },
      { $unset: { hasPassword: '' } },
    );
    await seedChildren(legacy.id, 'legacy');

    // Username alone must not be enough.
    await deleteMe(legacy.session, { confirmUsername: 'legacy' }).expect(400);
    await deleteMe(legacy.session, {
      confirmUsername: 'legacy',
      currentPassword: 'wrong-password1',
    }).expect(400);
    expect(await User.findById(legacy.id)).not.toBeNull();

    await deleteMe(legacy.session, {
      confirmUsername: 'legacy',
      currentPassword: 'password123',
    }).expect(200);
    expect(await User.findById(legacy.id)).toBeNull();
    expect(await countChildren(legacy.id)).toEqual(ALL_ZERO);
  });

  it('can be re-run after an interrupted attempt that only removed some children', async () => {
    const ada = await registerPasswordUser({ username: 'ada_l', email: 'ada@example.com' });
    await seedChildren(ada.id, 'ada');
    // Simulate a crash after the first child collection was cleared.
    await BookmarkNote.deleteMany({ userId: ada.id });

    await deleteMe(ada.session, {
      confirmUsername: 'ada_l',
      currentPassword: 'password123',
    }).expect(200);
    expect(await countChildren(ada.id)).toEqual(ALL_ZERO);
    expect(await User.findById(ada.id)).toBeNull();
  });
});
