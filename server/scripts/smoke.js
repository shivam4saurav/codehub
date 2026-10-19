/**
 * End-to-end boot check: `npm run smoke --workspace=server`
 *
 * Starts a throwaway in-memory MongoDB, boots the real server.js as a child
 * process against it, and hits the public endpoints. Proves the app actually
 * starts - something a unit test suite can quietly avoid doing.
 *
 * Nothing here touches your real database or .env values.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MongoMemoryServer } from 'mongodb-memory-server';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (attempts = 40) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return response.json();
    } catch {
      // Server not listening yet.
    }
    await wait(500);
  }
  throw new Error('Server did not become healthy in time');
};

const checks = [];
const check = (name, passed, detail = '') => {
  checks.push({ name, passed, detail });
   
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
};

const run = async () => {
   
  console.log('Starting in-memory MongoDB…');
  const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });

   
  console.log('Booting CodeHub API…');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      MONGODB_URI: mongo.getUri('codehub-smoke'),
      JWT_ACCESS_SECRET: 'smoke-access-secret-smoke-access-secret-01',
      JWT_REFRESH_SECRET: 'smoke-refresh-secret-smoke-refresh-secret-1',
      // Jobs would start hitting Codeforces; not what we are testing here.
      ENABLE_CRON: 'false',
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  child.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    const health = await waitForHealth();

    check('server boots and answers /api/health', health.status === 'ok', `status=${health.status}`);
    check('database connected', health.database?.connected === true);
    check('source health reported', Array.isArray(health.sources) && health.sources.length > 0);

    const taxonomy = await (await fetch(`${BASE}/api/taxonomy`)).json();
    check('taxonomy exposed', taxonomy.count >= 20, `${taxonomy.count} topics`);

    const register = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'smoke_user',
        email: 'smoke@example.com',
        password: 'smoketest1',
      }),
    });
    const cookies = register.headers.getSetCookie?.() ?? [];
    check('registration works', register.status === 201, `status=${register.status}`);
    check(
      'auth cookies are httpOnly',
      cookies.length >= 2 && cookies.every((cookie) => /HttpOnly/i.test(cookie)),
    );

    const cookieHeader = cookies.map((cookie) => cookie.split(';')[0]).join('; ');
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieHeader } });
    check('session works', me.status === 200, `status=${me.status}`);

    const problems = await (await fetch(`${BASE}/api/problems?limit=1`)).json();
    check('problem browser responds', Array.isArray(problems.items));

    const contests = await (await fetch(`${BASE}/api/contests`)).json();
    check('contest calendar responds', Array.isArray(contests.items));

    const notFound = await fetch(`${BASE}/api/nope`);
    check('unknown route returns JSON 404', notFound.status === 404);

    const failed = checks.filter((entry) => !entry.passed);

     
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);

    if (failed.length > 0) {
       
      console.error('\nServer output:\n', serverOutput.slice(-2000));
    }

    return failed.length === 0 ? 0 : 1;
  } catch (error) {
     
    console.error('Smoke test failed:', error.message, '\n', serverOutput.slice(-2000));
    return 1;
  } finally {
    child.kill('SIGTERM');
    await wait(500);
    if (!child.killed) child.kill('SIGKILL');
    await mongo.stop();
  }
};

run().then((code) => process.exit(code));
