import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import createApp, { isCrawler, resolveTrustProxy } from '../../app.js';
import {
  clientIpKey,
  loginAccountKey,
  userOrIpKey,
} from '../../middleware/rateLimiters.js';
import { safeRedirectPath } from '../../utils/safeRedirect.js';

/**
 * Behaviour that only matters once the app is deployed: how the server sees
 * visitors behind proxies, what "/" returns, what the CDN may cache, and the
 * Vercel routing file the frontend ships with.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const vercelConfig = JSON.parse(
  fs.readFileSync(path.resolve(here, '../../../client/vercel.json'), 'utf8'),
);

const CRAWLER_AGENTS = [
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'Twitterbot/1.0',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.23.20.0',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'TelegramBot (like TwitterBot)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
];

const BROWSER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
];

/* -------------------------------------------------------- proxy trust */

describe('proxy trust', () => {
  const ipBehind = (hops) => {
    const app = express();
    if (hops > 0) app.set('trust proxy', hops);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    return app;
  };

  it('defaults to one hop in production and none elsewhere', () => {
    expect(resolveTrustProxy(undefined, true)).toBe(1);
    expect(resolveTrustProxy(undefined, false)).toBe(0);
    expect(resolveTrustProxy(2, true)).toBe(2);
    expect(resolveTrustProxy(0, true)).toBe(0);
  });

  it('with Vercel in front (2 hops) sees the visitor, not Vercel', async () => {
    // Vercel sends the visitor's IP; Render's balancer appends Vercel's IP.
    const forwardedFor = '203.0.113.7, 198.51.100.9';

    const twoHops = await request(ipBehind(resolveTrustProxy(2, true)))
      .get('/ip')
      .set('X-Forwarded-For', forwardedFor);
    const oneHop = await request(ipBehind(resolveTrustProxy(undefined, true)))
      .get('/ip')
      .set('X-Forwarded-For', forwardedFor);

    expect(twoHops.body.ip).toBe('203.0.113.7');
    // The bug this setting fixes: everyone would share Vercel's address.
    expect(oneHop.body.ip).toBe('198.51.100.9');
  });
});

/* --------------------------------------------------- rate-limit keys */

describe('rate-limit keys', () => {
  it('keys guests by their IP address, not by the request object', () => {
    const key = clientIpKey({ ip: '203.0.113.7' });
    expect(key).toBe('ip:203.0.113.7');
    expect(clientIpKey({ ip: '198.51.100.1' })).not.toBe(key);
  });

  it('groups one IPv6 network together so it cannot rotate addresses', () => {
    expect(clientIpKey({ ip: '2001:db8:abcd:1200::1' })).toBe(
      clientIpKey({ ip: '2001:db8:abcd:1234::9' }),
    );
  });

  it('keys signed-in users by account and guests by IP', () => {
    expect(userOrIpKey({ user: { id: 'u1' }, ip: '203.0.113.7' })).toBe('user:u1');
    expect(userOrIpKey({ ip: '203.0.113.7' })).toBe('ip:203.0.113.7');
  });

  it('counts login attempts per account regardless of IP', () => {
    const fromA = loginAccountKey({ ip: '203.0.113.7', body: { identifier: ' Ada@Example.com ' } });
    const fromB = loginAccountKey({ ip: '198.51.100.1', body: { identifier: 'ada@example.com' } });

    expect(fromA).toBe('account:ada@example.com');
    expect(fromB).toBe(fromA);
    expect(loginAccountKey({ ip: '203.0.113.7', body: {} })).toBe('ip:203.0.113.7');
  });
});

/* ------------------------------------------------------- "/" and SPA */

describe('root route', () => {
  let distDir;

  beforeAll(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codehub-dist-'));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>CodeHub</title>');
  });

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the app at "/" when the client build is present', async () => {
    const app = createApp({ clientDist: distDir });
    const response = await request(app).get('/').set('Accept', 'text/html').expect(200);

    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('<title>CodeHub</title>');
  });

  it('answers "/" with JSON on an API-only deploy', async () => {
    const app = createApp({ clientDist: path.join(distDir, 'missing') });
    const response = await request(app).get('/').expect(200);

    expect(response.body).toMatchObject({ name: 'CodeHub API', status: 'ok' });
  });

  it('sends link-preview bots on /u/:username to the meta-tagged page', async () => {
    const app = createApp({ clientDist: distDir });

    const bot = await request(app)
      .get('/u/ada_l')
      .set('Accept', 'text/html')
      .set('User-Agent', CRAWLER_AGENTS[0]);
    const person = await request(app)
      .get('/u/ada_l')
      .set('Accept', 'text/html')
      .set('User-Agent', BROWSER_AGENTS[1]);

    expect(bot.status).toBe(302);
    expect(bot.headers.location).toBe('/share/ada_l');
    expect(person.status).toBe(200);
  });
});

/* ------------------------------------------------------- CDN caching */

describe('cache headers', () => {
  it('marks API responses as not storable by default', async () => {
    const app = createApp();
    const response = await request(app).get('/api/health');

    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});

/* ------------------------------------------------ redirect sanitising */

describe('safeRedirectPath', () => {
  // The server copy guards the OAuth `next` parameter; the client copy guards
  // ?next= after a password login. They must agree, so the rules live in two
  // files that this test keeps honest.
  const clientSource = fs.readFileSync(
    path.resolve(here, '../../../client/src/utils/safeRedirect.js'),
    'utf8',
  );

  it.each([
    'https://evil.example.com',
    'http://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    '/\\/evil.example.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'evil.example.com',
    '/login',
    '/register?next=/x',
    '',
  ])('refuses %s', (hostile) => {
    expect(safeRedirectPath(hostile, '/fallback')).toBe('/fallback');
  });

  it.each(['/', '/contests', '/u/ada', '/problems?topic=graphs', '/settings#sharing'])(
    'allows %s',
    (safe) => {
      expect(safeRedirectPath(safe, '/fallback')).toBe(safe);
    },
  );

  it('refuses a newline that would smuggle a header', () => {
    expect(safeRedirectPath('/ok\r\nLocation: https://evil.example.com', '/fallback')).toBe(
      '/fallback',
    );
  });

  it('survives a malformed percent-encoding', () => {
    expect(safeRedirectPath('/%E0%A4%A', '/fallback')).toBe('/fallback');
  });

  it('still exists on the client, with the same guard rules', () => {
    for (const rule of ['startsWith(\'/\')', '^\\/[/\\\\]', '^[a-z][a-z0-9+.-]*:']) {
      expect(clientSource).toContain(rule);
    }
  });
});

/* -------------------------------------------- client/vercel.json */

describe('client/vercel.json', () => {
  const rewrites = vercelConfig.rewrites ?? [];
  const external = rewrites.filter((rule) => /^https:\/\//.test(rule.destination));
  const crawlerRule = rewrites.find((rule) => rule.source === '/u/:username');
  const crawlerPattern = new RegExp(crawlerRule?.has?.[0]?.value?.re ?? '$^');

  it('forwards the API and share pages to one HTTPS backend', () => {
    const sources = external.map((rule) => rule.source);
    expect(sources).toEqual(expect.arrayContaining(['/api/:path*', '/share/:path*']));

    const hosts = new Set(external.map((rule) => new URL(rule.destination).host));
    expect(hosts.size).toBe(1);
  });

  it('keeps the original path when forwarding', () => {
    const api = rewrites.find((rule) => rule.source === '/api/:path*');
    expect(new URL(api.destination).pathname).toBe('/api/:path*');
  });

  it('falls back to index.html last, so deep links do not 404', () => {
    expect(rewrites.at(-1)).toEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('checks the crawler rule before the SPA fallback', () => {
    expect(rewrites.indexOf(crawlerRule)).toBeLessThan(rewrites.length - 1);
    expect(crawlerRule.has[0]).toMatchObject({ type: 'header', key: 'user-agent' });
    expect(new URL(crawlerRule.destination).pathname).toBe('/share/:username');
  });

  it.each(CRAWLER_AGENTS)('treats %s as a crawler (in both places)', (agent) => {
    expect(crawlerPattern.test(agent)).toBe(true);
    expect(isCrawler(agent)).toBe(true);
  });

  it.each(BROWSER_AGENTS)('treats %s as a person (in both places)', (agent) => {
    expect(crawlerPattern.test(agent)).toBe(false);
    expect(isCrawler(agent)).toBe(false);
  });
});
