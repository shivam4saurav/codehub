import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import createApp from '../../app.js';
import { PLATFORMS } from '../../config/constants.js';
import BookmarkNote from '../../models/BookmarkNote.js';
import Problem from '../../models/Problem.js';
import User from '../../models/User.js';
import cache from '../../utils/cache.js';
import { normalizeTags } from '../../utils/normalizeTags.js';
import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

const problem = ({
  externalId,
  name,
  rating,
  tags,
  platform = PLATFORMS.CODEFORCES,
  division = 2,
  solvedCount = 1000,
  difficulty,
}) => {
  const normalised = normalizeTags(platform, tags);

  return {
    platform,
    externalId,
    name,
    url: `https://example.test/${externalId}`,
    rawTags: normalised.rawTags,
    canonicalTopics: normalised.canonicalTopics,
    rating,
    difficulty: difficulty ?? null,
    solvedCount,
    division: platform === PLATFORMS.CODEFORCES ? division : null,
    contestId: platform === PLATFORMS.CODEFORCES ? Number(externalId.replace(/\D/g, '')) : null,
  };
};

const SEED = [
  problem({ externalId: '4A', name: 'Watermelon', rating: 800, tags: ['math', 'brute force'], division: 1, solvedCount: 620000 }),
  problem({ externalId: '455A', name: 'Boredom', rating: 1500, tags: ['dp'], solvedCount: 120000 }),
  problem({ externalId: '474D', name: 'Flowers', rating: 1700, tags: ['dp'], solvedCount: 47000 }),
  problem({ externalId: '20C', name: 'Dijkstra?', rating: 1900, tags: ['graphs', 'shortest paths'], solvedCount: 38000 }),
  problem({ externalId: '217A', name: 'Ice Skating', rating: 1200, tags: ['dsu', 'graphs'], solvedCount: 66000 }),
  problem({ externalId: '9999Z', name: 'Unrated Mystery', rating: null, tags: ['implementation'], division: 3, solvedCount: 10 }),
  problem({
    externalId: 'two-sum',
    name: 'Two Sum',
    rating: 1200,
    difficulty: 'Easy',
    tags: ['Array', 'Hash Table'],
    platform: PLATFORMS.LEETCODE,
    solvedCount: 0,
  }),
  problem({
    externalId: 'coin-change',
    name: 'Coin Change',
    rating: 1600,
    difficulty: 'Medium',
    tags: ['Dynamic Programming', 'Breadth-First Search'],
    platform: PLATFORMS.LEETCODE,
    solvedCount: 0,
  }),
];

describe('problem browser API', () => {
  let app;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Problem, User, BookmarkNote]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    cache.flush();
    await Problem.insertMany(SEED);
  });

  it('lists problems with pagination metadata', async () => {
    const response = await request(app).get('/api/problems?limit=3').expect(200);

    expect(response.body.items).toHaveLength(3);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 3,
      total: SEED.length,
      hasNext: true,
      hasPrevious: false,
    });
    // No handle linked, so status marks are explicitly absent.
    expect(response.body.items[0].userStatus).toBeNull();
  });

  it('filters by canonical topic across platforms', async () => {
    const response = await request(app)
      .get('/api/problems?topics=dynamic-programming')
      .expect(200);

    const names = response.body.items.map((item) => item.name).sort();
    // Codeforces "dp" and LeetCode "Dynamic Programming" are the same topic.
    expect(names).toEqual(['Boredom', 'Coin Change', 'Flowers']);
  });

  it('filters by platform and raw platform tag', async () => {
    const byPlatform = await request(app)
      .get('/api/problems?platform=leetcode')
      .expect(200);
    expect(byPlatform.body.items).toHaveLength(2);

    const byRawTag = await request(app)
      .get('/api/problems?platform=codeforces&rawTags=dp')
      .expect(200);
    expect(byRawTag.body.items.map((item) => item.externalId).sort()).toEqual(['455A', '474D']);
  });

  it('filters by rating range and keeps unrated problems only when asked', async () => {
    const withUnrated = await request(app)
      .get('/api/problems?ratingMin=1500&ratingMax=1800')
      .expect(200);

    expect(withUnrated.body.items.map((item) => item.externalId).sort()).toEqual(
      ['455A', '474D', '9999Z', 'coin-change'].sort(),
    );

    const ratedOnly = await request(app)
      .get('/api/problems?ratingMin=1500&ratingMax=1800&includeUnrated=false')
      .expect(200);

    expect(ratedOnly.body.items.every((item) => item.rating !== null)).toBe(true);
    expect(ratedOnly.body.items.map((item) => item.externalId)).not.toContain('9999Z');
  });

  it('filters by division and minimum solved count', async () => {
    const division = await request(app).get('/api/problems?divisions=1').expect(200);
    expect(division.body.items.map((item) => item.externalId)).toEqual(['4A']);

    const popular = await request(app).get('/api/problems?minSolvedCount=100000').expect(200);
    expect(popular.body.items.map((item) => item.externalId).sort()).toEqual(['455A', '4A']);
  });

  it('searches by problem name and by problem id', async () => {
    const byName = await request(app).get('/api/problems?search=flow').expect(200);
    expect(byName.body.items.map((item) => item.name)).toEqual(['Flowers']);

    const byId = await request(app).get('/api/problems?search=474').expect(200);
    expect(byId.body.items.map((item) => item.externalId)).toEqual(['474D']);
  });

  it('sorts by rating, popularity and name', async () => {
    const ratingDesc = await request(app)
      .get('/api/problems?sort=rating-desc&includeUnrated=false&limit=3')
      .expect(200);
    expect(ratingDesc.body.items.map((item) => item.rating)).toEqual([1900, 1700, 1600]);

    const popular = await request(app).get('/api/problems?sort=popularity&limit=2').expect(200);
    expect(popular.body.items.map((item) => item.externalId)).toEqual(['4A', '455A']);

    const byName = await request(app).get('/api/problems?sort=name&limit=1').expect(200);
    expect(byName.body.items[0].name).toBe('Boredom');
  });

  it('rejects an invalid rating window and unknown topics', async () => {
    const badRange = await request(app)
      .get('/api/problems?ratingMin=2000&ratingMax=1000')
      .expect(400);
    expect(badRange.body.error.code).toBe('VALIDATION_ERROR');

    await request(app).get('/api/problems?topics=not-a-real-topic').expect(400);
  });

  it('requires a handle before filtering by solve status', async () => {
    const response = await request(app).get('/api/problems?status=solved').expect(400);
    expect(response.body.error.code).toBe('HANDLE_REQUIRED');
  });

  it('reports topic counts, rating bounds and divisions in facets', async () => {
    const response = await request(app).get('/api/problems/facets?platform=codeforces').expect(200);

    const topics = Object.fromEntries(
      response.body.topics.map((topic) => [topic.key, topic.count]),
    );

    expect(topics['dynamic-programming']).toBe(2);
    expect(topics.graphs).toBe(2);
    expect(response.body.rating).toMatchObject({ min: 800, max: 1900 });
    expect(response.body.divisions).toEqual(
      expect.arrayContaining([{ division: 1, count: 1 }, { division: 2, count: 4 }]),
    );
    // "Other" is always last so the sidebar reads sensibly.
    expect(response.body.topics.at(-1).key).toBe('other');
  });

  it('exposes raw Codeforces tags with counts for the raw-tag toggle', async () => {
    const response = await request(app).get('/api/problems/raw-tags?platform=codeforces').expect(200);

    const tags = Object.fromEntries(response.body.tags.map((row) => [row.tag, row.count]));
    expect(tags.dp).toBe(2);
    expect(tags.graphs).toBe(2);
  });

  it('returns topic progress with zero solved for anonymous visitors', async () => {
    const response = await request(app).get('/api/problems/progress?platform=codeforces').expect(200);

    expect(response.body.totals.solved).toBe(0);
    expect(response.body.totals.problems).toBeGreaterThan(0);
    expect(response.body.status).toBeNull();
  });
});

describe('bookmarks and notes', () => {
  let app;
  let agent;
  let problemId;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([Problem, User, BookmarkNote]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    cache.flush();
    const inserted = await Problem.insertMany(SEED);
    problemId = String(inserted[1]._id);

    agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'grace_h', email: 'grace@example.com', password: 'compiler1' })
      .expect(201);
  });

  it('requires authentication', async () => {
    await request(app).get('/api/problems/bookmarks').expect(401);
    await request(app).patch(`/api/problems/${problemId}/bookmark`).send({ bookmarked: true }).expect(401);
  });

  it('bookmarks a problem, stores a note and lists it back', async () => {
    await agent
      .patch(`/api/problems/${problemId}/bookmark`)
      .send({ bookmarked: true, note: 'Classic pick-or-skip DP.' })
      .expect(200);

    const list = await agent.get('/api/problems/bookmarks').expect(200);

    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      externalId: '455A',
      bookmark: { bookmarked: true, done: false, note: 'Classic pick-or-skip DP.' },
    });
  });

  it('surfaces the bookmark inline in the problem list', async () => {
    await agent.patch(`/api/problems/${problemId}/bookmark`).send({ bookmarked: true }).expect(200);

    const response = await agent.get('/api/problems?search=Boredom').expect(200);
    expect(response.body.items[0].bookmark).toMatchObject({ bookmarked: true });
  });

  it('marks a bookmark done and filters by it', async () => {
    await agent.patch(`/api/problems/${problemId}/bookmark`).send({ bookmarked: true }).expect(200);
    await agent.patch(`/api/problems/${problemId}/bookmark`).send({ done: true }).expect(200);

    const done = await agent.get('/api/problems/bookmarks?done=true').expect(200);
    expect(done.body.items).toHaveLength(1);

    const notDone = await agent.get('/api/problems/bookmarks?done=false').expect(200);
    expect(notDone.body.items).toHaveLength(0);
  });

  it('removes a bookmark and 404s on a second delete', async () => {
    await agent.patch(`/api/problems/${problemId}/bookmark`).send({ bookmarked: true }).expect(200);
    await agent.delete(`/api/problems/${problemId}/bookmark`).expect(200);
    await agent.delete(`/api/problems/${problemId}/bookmark`).expect(404);
  });

  it('rejects a malformed problem id', async () => {
    await agent.patch('/api/problems/not-an-id/bookmark').send({ bookmarked: true }).expect(400);
  });

  it('keeps one bookmark per user and problem', async () => {
    await agent.patch(`/api/problems/${problemId}/bookmark`).send({ bookmarked: true }).expect(200);
    await agent.patch(`/api/problems/${problemId}/bookmark`).send({ note: 'second write' }).expect(200);

    const count = await BookmarkNote.countDocuments({ problemId });
    expect(count).toBe(1);
  });
});
