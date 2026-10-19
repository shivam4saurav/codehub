import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import createApp from '../../app.js';
import User from '../../models/User.js';
import { renderCardImage, renderCardSvg } from '../../services/shareCard.service.js';
import cache from '../../utils/cache.js';
import {
  clearCollections,
  startMemoryDb,
  stopMemoryDb,
  syncModelIndexes,
} from '../helpers/memoryDb.js';

const CARD = {
  username: 'ada_lovelace',
  displayName: 'Ada Lovelace',
  theme: 'dark-neon',
  handles: { codeforces: 'ada_cf', leetcode: 'ada_lc' },
  ratings: { codeforces: 1742, leetcode: 2011, codechef: null, codechefStars: null },
  totalSolved: 742,
  contests: 38,
  streak: 12,
  topTopics: [
    { topicKey: 'graphs', name: 'Graphs', accent: '#2dd4bf', solved: 120 },
    { topicKey: 'dynamic-programming', name: 'Dynamic Programming', accent: '#818cf8', solved: 96 },
  ],
  heatmap: { [new Date().toISOString().slice(0, 10)]: 4 },
};

describe('share card rendering', () => {
  it('renders an SVG at Open Graph dimensions', async () => {
    const svg = await renderCardSvg(CARD);

    expect(svg).toContain('<svg');
    expect(svg).toMatch(/width="1200"/);
    expect(svg).toMatch(/height="630"/);
  });

  it('rasterises to a real PNG', async () => {
    const { buffer, contentType } = await renderCardImage(CARD);

    expect(contentType).toBe('image/png');
    // PNG magic number.
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(buffer.length).toBeGreaterThan(5000);
  });

  it('renders every theme without throwing', async () => {
    for (const theme of ['dark-neon', 'glass', 'minimal-light', 'gradient']) {
      const svg = await renderCardSvg({ ...CARD, theme });
      expect(svg).toContain('<svg');
    }
  });

  it('survives a profile with no handles or topics', async () => {
    const svg = await renderCardSvg({
      username: 'newcomer',
      displayName: 'Newcomer',
      theme: 'glass',
      handles: {},
      ratings: {},
      totalSolved: 0,
      contests: 0,
      streak: 0,
      topTopics: [],
      heatmap: {},
    });

    expect(svg).toContain('<svg');
  });
});

describe('public profile endpoints', () => {
  let app;

  beforeAll(async () => {
    await startMemoryDb();
    await syncModelIndexes([User]);
    app = createApp();
  }, 60_000);

  afterAll(stopMemoryDb);

  beforeEach(async () => {
    await clearCollections();
    cache.flush();
  });

  const createUser = async ({ publicProfile }) =>
    User.create({
      username: 'ada_lovelace',
      email: 'ada@example.com',
      passwordHash: await User.hashPassword('analytical1'),
      displayName: 'Ada Lovelace',
      publicProfile,
    });

  it('hides a private profile behind a 404, not a 403', async () => {
    await createUser({ publicProfile: { enabled: false } });

    const response = await request(app).get('/api/public/ada_lovelace').expect(404);
    expect(response.body.error.code).toBe('PROFILE_NOT_PUBLIC');
  });

  it('404s an unknown username the same way', async () => {
    const response = await request(app).get('/api/public/nobody_here').expect(404);
    expect(response.body.error.code).toBe('PROFILE_NOT_PUBLIC');
  });

  it('serves a public profile once sharing is enabled', async () => {
    await createUser({ publicProfile: { enabled: true, cardTheme: 'gradient' } });

    const response = await request(app).get('/api/public/ada_lovelace').expect(200);

    expect(response.body.owner).toMatchObject({
      username: 'ada_lovelace',
      displayName: 'Ada Lovelace',
      cardTheme: 'gradient',
    });
    // No handles linked yet, so the dashboard section is explicitly empty.
    expect(response.body.empty).toBe(true);
  });

  it('never leaks the email unless the owner opted in', async () => {
    await createUser({ publicProfile: { enabled: true, showEmail: false } });

    const hidden = await request(app).get('/api/public/ada_lovelace').expect(200);
    expect(hidden.body.owner.email).toBeNull();
    expect(JSON.stringify(hidden.body)).not.toContain('ada@example.com');

    await User.updateOne(
      { usernameLower: 'ada_lovelace' },
      { $set: { 'publicProfile.showEmail': true } },
    );
    cache.flush();

    const shown = await request(app).get('/api/public/ada_lovelace').expect(200);
    expect(shown.body.owner.email).toBe('ada@example.com');
  });

  it('never exposes password material', async () => {
    await createUser({ publicProfile: { enabled: true } });

    const response = await request(app).get('/api/public/ada_lovelace').expect(200);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('serves the card image for a public profile', async () => {
    await createUser({ publicProfile: { enabled: true, cardTheme: 'dark-neon' } });

    const response = await request(app).get('/api/card/ada_lovelace.png').expect(200);

    expect(response.headers['content-type']).toMatch(/image\/png/);
    expect(response.body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('accepts a theme override on the card', async () => {
    await createUser({ publicProfile: { enabled: true } });

    await request(app).get('/api/card/ada_lovelace.png?theme=minimal-light').expect(200);
    await request(app).get('/api/card/ada_lovelace.png?theme=not-a-theme').expect(400);
  });

  it('refuses to render a card for a private profile', async () => {
    await createUser({ publicProfile: { enabled: false } });
    await request(app).get('/api/card/ada_lovelace.png').expect(404);
  });

  it('serves crawler HTML with per-user Open Graph tags', async () => {
    await createUser({ publicProfile: { enabled: true } });

    const response = await request(app).get('/share/ada_lovelace').expect(200);

    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('property="og:title" content="Ada Lovelace on CodeHub"');
    expect(response.text).toContain('property="og:image"');
    expect(response.text).toContain('/api/card/ada_lovelace.png');
    expect(response.text).toContain('name="twitter:card" content="summary_large_image"');
    // Humans are forwarded to the SPA route.
    expect(response.text).toContain('/u/ada_lovelace');
  });

  it('validates the username in share and card routes', async () => {
    await request(app).get('/share/a').expect(400);
    await request(app).get('/api/card/no.pe!.png').expect(400);
  });
});
