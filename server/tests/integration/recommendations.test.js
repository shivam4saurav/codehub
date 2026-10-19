import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { PLATFORMS } from '../../config/constants.js';
import { normalizeTags } from '../../utils/normalizeTags.js';
import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

/**
 * The recommender is exercised end to end against a real database, with only
 * the third-party HTTP adapters mocked. That keeps the interesting logic real:
 * topic scoring, solved-problem exclusion and the rating window.
 */

const DAY = 86_400_000;
const nowSeconds = Math.floor(Date.now() / 1000);

/** Submission history: strong in graphs, weak in DP, untouched geometry. */
const submissionFixture = () => {
  const submissions = [];

  const push = (id, name, rating, tags, verdict, daysAgo) =>
    submissions.push({
      verdict,
      creationTimeSeconds: nowSeconds - Math.floor((daysAgo * DAY) / 1000),
      problem: { contestId: Number(id.replace(/\D/g, '')), index: id.replace(/\d/g, ''), name, rating, tags },
    });

  // Graphs: many recent, harder solves -> strong.
  for (let index = 0; index < 20; index += 1) {
    push(`${100 + index}A`, `Graph problem ${index}`, 1800, ['graphs', 'dfs and similar'], 'OK', index % 7);
  }

  // DP: few, easy, old solves -> weak but active.
  for (let index = 0; index < 4; index += 1) {
    push(`${300 + index}B`, `DP problem ${index}`, 1100, ['dp'], 'OK', 150 + index);
  }

  // Greedy: moderate.
  for (let index = 0; index < 8; index += 1) {
    push(`${500 + index}C`, `Greedy problem ${index}`, 1400, ['greedy'], 'OK', 30 + index);
  }

  // An attempt that never succeeded must not count as solved.
  push('900Z', 'Failed attempt', 1600, ['dp'], 'WRONG_ANSWER', 3);

  return submissions;
};

jest.unstable_mockModule('../../services/sources/codeforces.service.js', () => ({
  fetchUserStatus: jest.fn(async () => submissionFixture()),
  fetchUserInfo: jest.fn(async (handle) => ({
    handle,
    rating: 1500,
    maxRating: 1600,
    rank: 'specialist',
    maxRank: 'expert',
    titlePhoto: null,
    contribution: 0,
    friendOfCount: 3,
    registrationTimeSeconds: nowSeconds - 400 * 86_400,
  })),
  fetchUserRating: jest.fn(async () => [
    { contestId: 1, contestName: 'Round 1', rank: 500, oldRating: 1400, newRating: 1500, ratingUpdateTimeSeconds: nowSeconds - 10 * 86_400 },
  ]),
  fetchProblemset: jest.fn(),
  fetchContestList: jest.fn(async () => []),
  problemExternalId: (problem) => `${problem.contestId ?? 'X'}${problem.index ?? ''}`,
  problemUrl: (problem) => `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
  parseDivision: () => 2,
  ratingToDifficulty: (rating) => (rating < 1400 ? 'Easy' : rating < 1900 ? 'Medium' : 'Hard'),
  isValidProblemset: () => true,
  isValidContestList: () => true,
  isValidUserInfo: () => true,
  codeforcesQueue: { add: (task) => task(), pending: 0 },
  default: {},
}));

jest.unstable_mockModule('../../services/sources/leetcode.service.js', () => ({
  fetchProblemPage: jest.fn(),
  fetchUserProfile: jest.fn(async () => {
    throw new Error('LeetCode not linked in this test');
  }),
  fetchUserContestInfo: jest.fn(),
  problemUrl: (slug) => `https://leetcode.com/problems/${slug}/`,
  difficultyToRating: (difficulty) => ({ Easy: 1200, Medium: 1600, Hard: 2100 })[difficulty] ?? null,
  isValidProblemPage: () => true,
  isValidUserProfile: () => true,
  default: {},
}));

const { default: createApp } = await import('../../app.js');
const { default: Problem } = await import('../../models/Problem.js');
const { default: User } = await import('../../models/User.js');
const { default: BookmarkNote } = await import('../../models/BookmarkNote.js');
const { default: ProfileSnapshot } = await import('../../models/ProfileSnapshot.js');
const { default: cache } = await import('../../utils/cache.js');

/** Problems to recommend from: DP and geometry at several ratings. */
const problemSeed = () => {
  const rows = [];

  const add = (externalId, name, rating, tags) => {
    const normalised = normalizeTags(PLATFORMS.CODEFORCES, tags);
    rows.push({
      platform: PLATFORMS.CODEFORCES,
      externalId,
      name,
      url: `https://codeforces.com/problemset/problem/${externalId}`,
      rawTags: normalised.rawTags,
      canonicalTopics: normalised.canonicalTopics,
      rating,
      difficulty: rating < 1400 ? 'Easy' : rating < 1900 ? 'Medium' : 'Hard',
      solvedCount: 10_000 - rating,
    });
  };

  // Inside the +100..+200 window for a 1500 level (1600-1700).
  add('7001A', 'DP in window A', 1600, ['dp']);
  add('7002B', 'DP in window B', 1700, ['dp']);
  add('7003C', 'Greedy in window', 1600, ['greedy']);
  add('7004D', 'Math in window', 1700, ['math']);

  // Outside the window - only used if it has to widen.
  add('7005E', 'DP too easy', 900, ['dp']);
  add('7006F', 'DP too hard', 2500, ['dp']);

  // Already solved by the fixture user (300B is in the solved list).
  add('300B', 'DP problem 0', 1600, ['dp']);

  return rows;
};

describe('GET /api/recommendations', () => {
  let app;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Problem, User, BookmarkNote, ProfileSnapshot]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    cache.flush();
    await Problem.insertMany(problemSeed());
  });

  it('requires at least one handle', async () => {
    const response = await request(app).get('/api/recommendations').expect(400);
    expect(response.body.error.code).toBe('NO_HANDLES');
  });

  it('identifies the weakest ACTIVE topics from real solve history', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser')
      .expect(200);

    const weakKeys = response.body.weakTopics.map((topic) => topic.topicKey);

    // The fixture only has three active topics, so all three are returned -
    // what matters is the ORDER: weakest first.
    expect(weakKeys[0]).toBe('dynamic-programming');
    expect(weakKeys.at(-1)).toBe('graphs');
    expect(response.body.meta.isColdStart).toBe(false);

    const dp = response.body.weakTopics[0];
    const graphs = response.body.weakTopics.at(-1);
    expect(dp.score).toBeLessThan(graphs.score);
  });

  it('targets the user rating + 100..200 window', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser')
      .expect(200);

    expect(response.body.level).toMatchObject({ rating: 1500, basis: 'codeforces-rating' });
    expect(response.body.target).toMatchObject({ ratingMin: 1600, ratingMax: 1700 });

    const dpItems = response.body.items.filter((item) => item.topicKey === 'dynamic-programming');
    expect(dpItems.length).toBeGreaterThan(0);

    // In-window problems must be used before anything outside the band.
    const inWindow = dpItems.filter((item) => item.targetWindow?.label === 'target');
    expect(inWindow.map((item) => item.externalId).sort()).toEqual(['7001A', '7002B']);

    for (const item of inWindow) {
      expect(item.rating).toBeGreaterThanOrEqual(1600);
      expect(item.rating).toBeLessThanOrEqual(1700);
    }

    // Anything beyond the band is explicitly labelled as a widened match.
    for (const item of dpItems) {
      if (item.rating < 1600 || item.rating > 1700) {
        expect(item.targetWindow.label).not.toBe('target');
      }
    }
  });

  it('never recommends a problem the user already solved', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser&count=24')
      .expect(200);

    const ids = response.body.items.map((item) => item.externalId);

    // 300B is in the solved fixture even though its rating fits the window.
    expect(ids).not.toContain('300B');
    expect(response.body.meta.excludedSolved).toBeGreaterThan(20);
  });

  it('does not count failed attempts as solved', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser')
      .expect(200);

    const dp = response.body.weakTopics.find(
      (topic) => topic.topicKey === 'dynamic-programming',
    );

    // 4 accepted DP solves; the WRONG_ANSWER submission must not inflate it.
    expect(dp.solved).toBe(4);
  });

  it('explains every recommendation with the numbers behind it', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser')
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);

    for (const item of response.body.items) {
      expect(item.reason).toBeTruthy();
      expect(item.reason).toMatch(/solved/);
      expect(item.topicName).toBeTruthy();
    }

    const dpItem = response.body.items.find((item) => item.topicKey === 'dynamic-programming');
    expect(dpItem.reason).toContain('Dynamic Programming');
    expect(dpItem.reason).toContain('4 solved');
  });

  it('honours an explicit topic override', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser&topics=math&count=6')
      .expect(200);

    expect(response.body.weakTopics.map((topic) => topic.topicKey)).toEqual(['math']);
    expect(response.body.items.every((item) => item.topicKey === 'math')).toBe(true);
  });

  it('respects the count limit and a custom difficulty offset', async () => {
    const limited = await request(app)
      .get('/api/recommendations?codeforces=testuser&count=2')
      .expect(200);
    expect(limited.body.items.length).toBeLessThanOrEqual(2);

    const stretched = await request(app)
      .get('/api/recommendations?codeforces=testuser&difficultyOffset=400')
      .expect(200);
    expect(stretched.body.target.ratingMin).toBe(1900);
    expect(stretched.body.target.ratingMax).toBe(2000);
  });

  it('rejects an unknown topic and an oversized count', async () => {
    await request(app).get('/api/recommendations?codeforces=x&topics=nope').expect(400);
    await request(app).get('/api/recommendations?codeforces=x&count=9999').expect(400);
  });

  it('separates never-attempted topics from weak ones', async () => {
    const response = await request(app)
      .get('/api/recommendations?codeforces=testuser')
      .expect(200);

    const exploreKeys = response.body.exploreTopics.map((topic) => topic.topicKey);
    const weakKeys = response.body.weakTopics.map((topic) => topic.topicKey);

    expect(exploreKeys.length).toBeGreaterThan(0);
    for (const key of exploreKeys) expect(weakKeys).not.toContain(key);
  });

  it('excludes problems the signed-in user marked done', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'linus_t', email: 'linus@example.com', password: 'kernel123' })
      .expect(201);

    const inWindow = await Problem.findOne({ externalId: '7001A' });
    await agent
      .patch(`/api/problems/${inWindow._id}/bookmark`)
      .send({ bookmarked: true, done: true })
      .expect(200);

    const response = await agent
      .get('/api/recommendations?codeforces=testuser&count=24')
      .expect(200);

    expect(response.body.items.map((item) => item.externalId)).not.toContain('7001A');
    expect(response.body.meta.excludedDone).toBe(1);
  });

  it('stores recommendation history for a signed-in user', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'ken_t', email: 'ken@example.com', password: 'unixv6pass1' })
      .expect(201);

    await agent.get('/api/recommendations?codeforces=testuser').expect(200);

    // History is written in the background; give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const history = await agent.get('/api/recommendations/history').expect(200);
    expect(history.body.history.length).toBeGreaterThan(0);
    expect(history.body.history[0].weakTopics.length).toBeGreaterThan(0);
  });

  it('requires authentication for history', async () => {
    await request(app).get('/api/recommendations/history').expect(401);
  });
});
