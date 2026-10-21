import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import createApp from '../../app.js';
import { recordFailure, recordSuccess, __reset } from '../../services/sourceHealth.service.js';

/**
 * /api/health must answer even with no database connection - that is the whole
 * point of it during an outage or a demo.
 */
describe('GET /api/health', () => {
  let app;

  beforeAll(() => {
    __reset();
    app = createApp();
  });

  it('responds without a database connection', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'degraded',
      database: { connected: false },
    });
    expect(Array.isArray(response.body.sources)).toBe(true);
    expect(response.body.sources.length).toBeGreaterThan(0);
  });

  it('reports every known third-party source', async () => {
    const response = await request(app).get('/api/health').expect(200);
    const names = response.body.sources.map((source) => source.source);

    expect(names).toContain('codeforces:problemset');
    expect(names).toContain('leetcode:profile');
    expect(names).toContain('codechef:profile');
  });

  it('reflects recorded successes and failures per source', async () => {
    recordSuccess('codeforces:problemset', { latencyMs: 120 });
    recordFailure('leetcode:profile', new Error('socket hang up'));

    const response = await request(app).get('/api/health').expect(200);
    const bySource = Object.fromEntries(
      response.body.sources.map((source) => [source.source, source]),
    );

    expect(bySource['codeforces:problemset']).toMatchObject({ status: 'ok', lastLatencyMs: 120 });
    expect(bySource['codeforces:problemset'].lastSuccessAt).toBeTruthy();

    expect(bySource['leetcode:profile'].status).toBe('down');
    expect(bySource['leetcode:profile'].lastError).toMatch(/socket hang up/);
  });

  it('exposes integration configuration without leaking secrets', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.integrations).toEqual({
      clist: expect.stringMatching(/configured|not-configured/),
      smtp: expect.stringMatching(/configured|console-fallback/),
      google: expect.stringMatching(/configured|not-configured/),
    });
    expect(JSON.stringify(response.body)).not.toMatch(/secret|password/i);
  });
});

describe('API basics', () => {
  it('returns a JSON 404 envelope for unknown routes', async () => {
    const app = createApp();
    const response = await request(app).get('/api/does-not-exist').expect(404);

    expect(response.body.error).toMatchObject({ code: 'NO_ROUTE' });
  });

  it('exposes the canonical taxonomy for the client', async () => {
    const app = createApp();
    const response = await request(app).get('/api/taxonomy').expect(200);

    expect(response.body.count).toBeGreaterThanOrEqual(20);
    const keys = response.body.topics.map((topic) => topic.key);
    expect(keys).toContain('dynamic-programming');
    expect(keys).toContain('graphs');
  });
});
