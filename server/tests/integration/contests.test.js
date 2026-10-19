import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import createApp from '../../app.js';
import { PLATFORMS } from '../../config/constants.js';
import Contest from '../../models/Contest.js';
import cache from '../../utils/cache.js';
import { buildContestIcs, googleCalendarUrl, toIcsStamp } from '../../utils/ics.js';
import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

const HOUR = 3_600_000;

const contest = (overrides) => {
  const startTime = overrides.startTime;

  return {
    platform: PLATFORMS.CODEFORCES,
    externalId: overrides.externalId,
    name: overrides.name,
    url: 'https://codeforces.com/contest/1',
    startTime,
    endTime: new Date(startTime.getTime() + (overrides.durationSeconds ?? 7200) * 1000),
    durationSeconds: overrides.durationSeconds ?? 7200,
    source: 'codeforces:contests',
    fetchedAt: overrides.fetchedAt ?? new Date(),
    ...overrides,
  };
};

const SEED = [
  contest({
    externalId: 'cf-upcoming',
    name: 'Codeforces Round 999 (Div. 2)',
    startTime: new Date(Date.now() + 24 * HOUR),
    division: 2,
  }),
  contest({
    externalId: 'cf-running',
    name: 'Codeforces Round 998 (Div. 1)',
    startTime: new Date(Date.now() - HOUR),
    division: 1,
  }),
  contest({
    externalId: 'cf-past',
    name: 'Codeforces Round 997',
    startTime: new Date(Date.now() - 72 * HOUR),
  }),
  contest({
    platform: PLATFORMS.LEETCODE,
    externalId: 'lc-weekly',
    name: 'Weekly Contest 500',
    startTime: new Date(Date.now() + 48 * HOUR),
    durationSeconds: 5400,
    source: 'clist:contests',
  }),
  contest({
    platform: PLATFORMS.CODECHEF,
    externalId: 'cc-starters',
    name: 'Starters 200',
    startTime: new Date(Date.now() + 72 * HOUR),
    durationSeconds: 10_800,
    source: 'clist:contests',
  }),
  contest({
    platform: PLATFORMS.CODECHEF,
    externalId: 'cc-long',
    name: 'Long Challenge',
    startTime: new Date(Date.now() + 96 * HOUR),
    durationSeconds: 10 * 24 * 3600,
    source: 'clist:contests',
  }),
];

describe('GET /api/contests', () => {
  let app;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Contest]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    cache.flush();
    await Contest.insertMany(SEED);
  });

  it('returns upcoming contests from every platform by default', async () => {
    const response = await request(app).get('/api/contests').expect(200);

    const ids = response.body.items.map((item) => item.externalId);
    expect(ids).toContain('cf-upcoming');
    expect(ids).toContain('lc-weekly');
    expect(ids).toContain('cc-starters');

    // Past and running contests are excluded from "upcoming".
    expect(ids).not.toContain('cf-past');
    expect(ids).not.toContain('cf-running');
  });

  it('sorts upcoming contests by start time', async () => {
    const response = await request(app).get('/api/contests').expect(200);
    const times = response.body.items.map((item) => new Date(item.startTime).getTime());

    expect([...times]).toEqual([...times].sort((a, b) => a - b));
  });

  it('computes the phase on read rather than trusting stored values', async () => {
    const running = await request(app).get('/api/contests?status=running').expect(200);

    expect(running.body.items).toHaveLength(1);
    expect(running.body.items[0]).toMatchObject({ externalId: 'cf-running', phase: 'coding' });

    const past = await request(app).get('/api/contests?status=past').expect(200);
    expect(past.body.items.every((item) => item.phase === 'finished')).toBe(true);
  });

  it('filters by platform', async () => {
    const response = await request(app)
      .get('/api/contests?platforms=leetcode,codechef&status=all')
      .expect(200);

    expect(response.body.items.every((item) => item.platform !== 'codeforces')).toBe(true);
    expect(response.body.counts.byPlatform).toMatchObject({ leetcode: 1, codechef: 2 });
  });

  it('filters by duration so multi-day contests can be hidden', async () => {
    const short = await request(app)
      .get('/api/contests?status=all&maxDurationHours=4')
      .expect(200);

    expect(short.body.items.map((item) => item.externalId)).not.toContain('cc-long');

    const long = await request(app)
      .get('/api/contests?status=all&minDurationHours=24')
      .expect(200);

    expect(long.body.items.map((item) => item.externalId)).toEqual(['cc-long']);
  });

  it('supports an explicit date range for the calendar view', async () => {
    const from = new Date(Date.now() + 36 * HOUR).toISOString();
    const to = new Date(Date.now() + 80 * HOUR).toISOString();

    const response = await request(app)
      .get(`/api/contests?status=all&from=${from}&to=${to}`)
      .expect(200);

    const ids = response.body.items.map((item) => item.externalId);
    expect(ids).toEqual(expect.arrayContaining(['lc-weekly', 'cc-starters']));
    expect(ids).not.toContain('cf-upcoming');
  });

  it('rejects an inverted date range', async () => {
    const from = new Date(Date.now() + 80 * HOUR).toISOString();
    const to = new Date(Date.now() + 36 * HOUR).toISOString();

    await request(app).get(`/api/contests?from=${from}&to=${to}`).expect(400);
    await request(app).get('/api/contests?platforms=myspace').expect(400);
  });

  it('serves the cache and reports freshness honestly', async () => {
    const fresh = await request(app).get('/api/contests').expect(200);
    expect(fresh.body.stale).toBe(false);
    expect(fresh.body.source).toBe('mongodb-cache');

    // Age every row past the freshness window.
    await Contest.updateMany({}, { $set: { fetchedAt: new Date(Date.now() - 5 * HOUR) } });
    cache.flush();

    const stale = await request(app).get('/api/contests').expect(200);
    expect(stale.body.stale).toBe(true);
    expect(stale.body.fetchedAt).toBeTruthy();
    // Crucially, the data itself is still served.
    expect(stale.body.items.length).toBeGreaterThan(0);
  });

  it('says when clist.by is not configured instead of pretending', async () => {
    const response = await request(app).get('/api/contests').expect(200);

    expect(response.body.clistConfigured).toBe(false);
    expect(response.body.sources.clist.status).toBe('not-configured');
  });

  it('attaches a Google Calendar link and an ics route to every contest', async () => {
    const response = await request(app).get('/api/contests').expect(200);
    const item = response.body.items[0];

    expect(item.googleCalendarUrl).toContain('calendar.google.com');
    expect(item.googleCalendarUrl).toContain('action=TEMPLATE');
    expect(item.icsUrl).toBe(`/api/contests/${item.id}/ics`);
  });
});

describe('GET /api/contests/:id/ics', () => {
  let app;
  let contestId;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Contest]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    cache.flush();
    const inserted = await Contest.insertMany(SEED);
    contestId = String(inserted[0]._id);
  });

  it('returns a downloadable calendar file', async () => {
    const response = await request(app).get(`/api/contests/${contestId}/ics`).expect(200);

    expect(response.headers['content-type']).toMatch(/text\/calendar/);
    expect(response.headers['content-disposition']).toMatch(/attachment; filename=".*\.ics"/);

    expect(response.text).toContain('BEGIN:VCALENDAR');
    expect(response.text).toContain('BEGIN:VEVENT');
    expect(response.text).toContain('END:VCALENDAR');
    expect(response.text).toContain('SUMMARY:Codeforces Round 999 (Div. 2)');
    // CRLF line endings are required by RFC 5545.
    expect(response.text).toContain('\r\n');
  });

  it('includes an alarm when a lead time is requested', async () => {
    const response = await request(app)
      .get(`/api/contests/${contestId}/ics?reminderMinutes=30`)
      .expect(200);

    expect(response.text).toContain('BEGIN:VALARM');
    expect(response.text).toContain('TRIGGER:-PT30M');
  });

  it('404s for an unknown contest and 400s for a malformed id', async () => {
    await request(app).get('/api/contests/0123456789abcdef01234567/ics').expect(404);
    await request(app).get('/api/contests/not-an-id/ics').expect(400);
  });
});

describe('ics helpers', () => {
  it('formats timestamps as UTC basic format', () => {
    expect(toIcsStamp('2026-09-25T14:30:00.000Z')).toBe('20260925T143000Z');
  });

  it('escapes characters that would corrupt the file', () => {
    const ics = buildContestIcs({
      name: 'Round; with, commas\\and newline\nhere',
      url: 'https://example.test',
      startTime: '2026-09-25T14:30:00Z',
      endTime: '2026-09-25T16:30:00Z',
      platform: 'codeforces',
    });

    expect(ics).toContain('\\;');
    expect(ics).toContain('\\,');
    expect(ics).toContain('\\n');
    expect(ics).not.toMatch(/SUMMARY:[^\r\n]*\n[^ ]/);
  });

  it('builds a Google Calendar link with a UTC range', () => {
    const url = googleCalendarUrl({
      name: 'Weekly Contest 500',
      url: 'https://leetcode.com/contest/weekly-contest-500',
      startTime: '2026-09-27T02:30:00Z',
      endTime: '2026-09-27T04:00:00Z',
      platform: 'leetcode',
    });

    expect(url).toContain('dates=20260927T023000Z%2F20260927T040000Z');
    expect(url).toContain('text=Weekly+Contest+500');
  });
});
