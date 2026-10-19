import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import createApp from '../../app.js';
import { PLATFORMS, REMINDER_STATUS } from '../../config/constants.js';
import Contest from '../../models/Contest.js';
import Reminder from '../../models/Reminder.js';
import User from '../../models/User.js';
import {
  claimNextDueReminder,
  processDueReminders,
  requeueStuckClaims,
} from '../../services/reminder.service.js';
import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

const HOUR = 3_600_000;

const makeContest = async (overrides = {}) => {
  const startTime = overrides.startTime ?? new Date(Date.now() + 48 * HOUR);

  return Contest.create({
    platform: PLATFORMS.CODEFORCES,
    externalId: overrides.externalId ?? `c-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Codeforces Round 1000 (Div. 2)',
    url: 'https://codeforces.com/contest/1000',
    startTime,
    endTime: new Date(startTime.getTime() + 2 * HOUR),
    durationSeconds: 7200,
    source: 'codeforces:contests',
    fetchedAt: new Date(),
    ...overrides,
  });
};

/** Insert a reminder that is already due, bypassing the API's future check. */
const makeDueReminder = async (userId, overrides = {}) => {
  const startTime = overrides.startTime ?? new Date(Date.now() + 2 * HOUR);
  const contest = await makeContest({ startTime });

  return Reminder.create({
    userId,
    contestId: contest._id,
    contest: {
      platform: contest.platform,
      externalId: contest.externalId,
      name: contest.name,
      url: contest.url,
      startTime: contest.startTime,
    },
    offsetKey: '1h',
    dueAt: overrides.dueAt ?? new Date(Date.now() - 60_000),
    email: 'reminders@example.com',
    status: overrides.status ?? REMINDER_STATUS.SCHEDULED,
    attempts: overrides.attempts ?? 0,
    ...(overrides.claimedAt ? { claimedAt: overrides.claimedAt } : {}),
  });
};

describe('reminder API', () => {
  let app;
  let agent;
  let userId;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Contest, Reminder, User]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();

    agent = request.agent(app);
    const registered = await agent
      .post('/api/auth/register')
      .send({ username: 'margaret_h', email: 'margaret@example.com', password: 'apollo11guide' })
      .expect(201);

    userId = registered.body.user.id;
  });

  it('requires authentication', async () => {
    await request(app).get('/api/reminders').expect(401);
    await request(app).post('/api/reminders').send({}).expect(401);
  });

  it('creates a reminder and computes dueAt from the contest start', async () => {
    const contest = await makeContest({ startTime: new Date(Date.now() + 48 * HOUR) });

    const response = await agent
      .post('/api/reminders')
      .send({ contestId: String(contest._id), offsetKey: '1d' })
      .expect(201);

    expect(response.body.reminder).toMatchObject({
      offsetKey: '1d',
      status: REMINDER_STATUS.SCHEDULED,
      channel: 'email',
    });

    const expectedDue = new Date(contest.startTime).getTime() - 24 * HOUR;
    expect(new Date(response.body.reminder.dueAt).getTime()).toBe(expectedDue);
  });

  it('refuses a lead time that has already passed', async () => {
    // Starts in 30 minutes, so a 1-hour reminder is impossible.
    const contest = await makeContest({ startTime: new Date(Date.now() + 0.5 * HOUR) });

    const response = await agent
      .post('/api/reminders')
      .send({ contestId: String(contest._id), offsetKey: '1h' })
      .expect(400);

    expect(response.body.error.code).toBe('REMINDER_TOO_LATE');
  });

  it('keeps one reminder per contest and offset, and allows different offsets', async () => {
    const contest = await makeContest();

    await agent.post('/api/reminders').send({ contestId: String(contest._id), offsetKey: '1d' }).expect(201);
    await agent.post('/api/reminders').send({ contestId: String(contest._id), offsetKey: '1d' }).expect(201);
    await agent.post('/api/reminders').send({ contestId: String(contest._id), offsetKey: '1h' }).expect(201);

    const list = await agent.get('/api/reminders').expect(200);
    expect(list.body.reminders).toHaveLength(2);
    expect(await Reminder.countDocuments({ contestId: contest._id })).toBe(2);
  });

  it('validates the contest id and the offset', async () => {
    await agent.post('/api/reminders').send({ contestId: 'nope', offsetKey: '1h' }).expect(400);

    const contest = await makeContest();
    await agent
      .post('/api/reminders')
      .send({ contestId: String(contest._id), offsetKey: '2w' })
      .expect(400);
  });

  it('404s for a contest that does not exist', async () => {
    await agent
      .post('/api/reminders')
      .send({ contestId: '0123456789abcdef01234567', offsetKey: '1h' })
      .expect(404);
  });

  it('cancels a reminder and refuses to cancel it twice', async () => {
    const contest = await makeContest();
    const created = await agent
      .post('/api/reminders')
      .send({ contestId: String(contest._id), offsetKey: '1d' })
      .expect(201);

    await agent.delete(`/api/reminders/${created.body.reminder.id}`).expect(200);
    await agent.delete(`/api/reminders/${created.body.reminder.id}`).expect(400);

    const list = await agent.get('/api/reminders').expect(200);
    expect(list.body.reminders[0].status).toBe(REMINDER_STATUS.CANCELLED);
  });

  it('never exposes another user\'s reminders', async () => {
    const contest = await makeContest();
    await agent.post('/api/reminders').send({ contestId: String(contest._id), offsetKey: '1d' }).expect(201);

    const other = request.agent(app);
    await other
      .post('/api/auth/register')
      .send({ username: 'other_user', email: 'other@example.com', password: 'otherpass1' })
      .expect(201);

    const list = await other.get('/api/reminders').expect(200);
    expect(list.body.reminders).toHaveLength(0);
  });

  it('reports the delivery channel honestly', async () => {
    const response = await agent.get('/api/reminders').expect(200);

    // No SMTP in tests, so the API must say so rather than implying email went out.
    expect(response.body.delivery).toMatchObject({
      email: 'margaret@example.com',
      channel: 'console-fallback',
    });
  });

  it('exposes the user id used for scoping', () => {
    expect(userId).toBeTruthy();
  });
});

describe('reminder dispatch: no double sends', () => {
  let app;
  let user;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Contest, Reminder, User]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    user = await User.create({
      username: 'dispatcher',
      email: 'dispatch@example.com',
      passwordHash: await User.hashPassword('dispatch123'),
    });
  });

  it('claims a due reminder exactly once', async () => {
    await makeDueReminder(user._id);

    const first = await claimNextDueReminder();
    const second = await claimNextDueReminder();

    expect(first).not.toBeNull();
    expect(first.status).toBe(REMINDER_STATUS.CLAIMED);
    // The second call finds nothing claimable - the row is no longer 'scheduled'.
    expect(second).toBeNull();
  });

  it('does not claim reminders that are not due yet', async () => {
    await makeDueReminder(user._id, { dueAt: new Date(Date.now() + 10 * 60_000) });

    expect(await claimNextDueReminder()).toBeNull();
  });

  it('sends one email per reminder even when two workers run concurrently', async () => {
    await makeDueReminder(user._id);
    await makeDueReminder(user._id);

    const sender = jest.fn(async () => ({ delivered: true }));

    // Two "server instances" draining the queue at the same moment.
    const [workerA, workerB] = await Promise.all([
      processDueReminders({ sender }),
      processDueReminders({ sender }),
    ]);

    expect(sender).toHaveBeenCalledTimes(2);
    expect(workerA.sent + workerB.sent).toBe(2);

    const sent = await Reminder.countDocuments({ status: REMINDER_STATUS.SENT });
    expect(sent).toBe(2);
  });

  it('does not resend after a restart', async () => {
    await makeDueReminder(user._id);

    const sender = jest.fn(async () => ({ delivered: true }));

    const firstRun = await processDueReminders({ sender });
    expect(firstRun.sent).toBe(1);

    // Simulates the process restarting and the cron firing again.
    const secondRun = await processDueReminders({ sender });

    expect(secondRun.claimed).toBe(0);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it('marks a reminder sent with a timestamp', async () => {
    const reminder = await makeDueReminder(user._id);
    await processDueReminders({ sender: async () => ({ delivered: true }) });

    const updated = await Reminder.findById(reminder._id).lean();

    expect(updated.status).toBe(REMINDER_STATUS.SENT);
    expect(updated.sentAt).toBeInstanceOf(Date);
    expect(updated.attempts).toBe(1);
  });

  it('skips a reminder whose contest already started', async () => {
    await makeDueReminder(user._id, {
      startTime: new Date(Date.now() - HOUR),
      dueAt: new Date(Date.now() - 2 * HOUR),
    });

    const sender = jest.fn();
    const summary = await processDueReminders({ sender });

    expect(sender).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    expect(await Reminder.countDocuments({ status: REMINDER_STATUS.SKIPPED })).toBe(1);
  });

  it('retries a transient failure, then gives up after three attempts', async () => {
    const reminder = await makeDueReminder(user._id);
    const sender = jest.fn(async () => {
      throw new Error('SMTP timeout');
    });

    await processDueReminders({ sender });
    let row = await Reminder.findById(reminder._id).lean();
    // Back to scheduled so the next tick can retry.
    expect(row.status).toBe(REMINDER_STATUS.SCHEDULED);
    expect(row.attempts).toBe(1);
    expect(row.lastError).toMatch(/SMTP timeout/);

    await processDueReminders({ sender });
    await processDueReminders({ sender });

    row = await Reminder.findById(reminder._id).lean();
    expect(row.attempts).toBe(3);
    expect(row.status).toBe(REMINDER_STATUS.FAILED);

    // A failed reminder is not retried forever.
    const after = await processDueReminders({ sender });
    expect(after.claimed).toBe(0);
    expect(sender).toHaveBeenCalledTimes(3);
  });

  it('never sends a cancelled reminder', async () => {
    await makeDueReminder(user._id, { status: REMINDER_STATUS.CANCELLED });

    const sender = jest.fn();
    const summary = await processDueReminders({ sender });

    expect(summary.claimed).toBe(0);
    expect(sender).not.toHaveBeenCalled();
  });

  it('requeues a claim left stranded by a crashed worker', async () => {
    const reminder = await makeDueReminder(user._id, {
      status: REMINDER_STATUS.CLAIMED,
      claimedAt: new Date(Date.now() - 30 * 60_000),
      attempts: 1,
    });

    const requeued = await requeueStuckClaims({ graceMinutes: 10 });
    expect(requeued).toBe(1);

    const row = await Reminder.findById(reminder._id).lean();
    expect(row.status).toBe(REMINDER_STATUS.SCHEDULED);
    expect(row.claimedAt).toBeNull();

    // And it can now be delivered normally.
    const sender = jest.fn(async () => ({ delivered: true }));
    const summary = await processDueReminders({ sender });
    expect(summary.sent).toBe(1);
  });

  it('leaves a fresh claim alone', async () => {
    await makeDueReminder(user._id, {
      status: REMINDER_STATUS.CLAIMED,
      claimedAt: new Date(),
      attempts: 1,
    });

    expect(await requeueStuckClaims({ graceMinutes: 10 })).toBe(0);
  });

  it('bounds how much one tick processes', async () => {
    for (let index = 0; index < 5; index += 1) await makeDueReminder(user._id);

    const sender = jest.fn(async () => ({ delivered: true }));
    const summary = await processDueReminders({ sender, maxPerRun: 2 });

    expect(summary.claimed).toBe(2);
    expect(await Reminder.countDocuments({ status: REMINDER_STATUS.SCHEDULED })).toBe(3);
  });

  it('exposes the app for route-level checks', () => {
    expect(app).toBeTruthy();
  });
});
