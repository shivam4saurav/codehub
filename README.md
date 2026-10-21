# CodeHub

A unified dashboard for competitive programmers who use **LeetCode, Codeforces and CodeChef**.

CodeHub answers a question none of the three platforms can answer on its own: *where am I actually
weak, and what should I solve next?* It does that by normalising three different topic vocabularies
into one taxonomy, then building every feature on top of that shared vocabulary.

Built as a final-year capstone project on the MERN stack.

---

## Contents

- [What it does](#what-it-does)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [The canonical taxonomy](#the-canonical-taxonomy)
- [The recommender formula](#the-recommender-formula)
- [Reliability: stale-while-error](#reliability-stale-while-error)
- [Reminders that cannot double-send](#reminders-that-cannot-double-send)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Tests](#tests)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Future work](#future-work)

---

## What it does

**1. One topic vocabulary.** Codeforces says `dp`, LeetCode says `Dynamic Programming`, CodeChef says
`dynamic-programming`. CodeHub maps all of them to a single canonical topic, so progress across three
judges finally adds up. 26 canonical topics, plus an explicit `Other` bucket for unmapped tags.

**2. Topic-wise problem browser.** LeetCode lets you browse by topic; Codeforces does not. CodeHub
builds that browser: multi-select topics, rating range slider, division, minimum solve count, search,
server-side pagination, and a toggle between canonical topics and the platform's own raw tags. With a
linked handle, every problem is marked **Solved / Attempted / Unsolved** and each topic gets a
progress bar. Problems can be bookmarked, annotated and marked done.

**3. Weak-topic recommender.** Scores every topic on solve volume, difficulty and recency, picks the
three weakest *active* topics, then recommends unsolved problems at your level **+100 to +200 rating**.
Every card explains itself: *"Dynamic Programming is one of your weaker active topics: 8 solved, avg
rating 1100, last solved 42d ago."*

**4. Unified contest calendar.** Codeforces, LeetCode and CodeChef in one list or month grid, colour
coded by platform, with live countdowns in your timezone. Email reminders at 1 day / 1 hour /
15 minutes, an **Add to Google Calendar** link, and a downloadable `.ics` file.

**5. Unified profile dashboard.** Per-platform cards (ratings, rating graphs, solved counts, badges,
stars, ranks) plus a combined view: total solved, merged activity heatmap, streaks, strongest and
weakest topics, and a platform-comparison radar chart. Guests can view any dashboard by entering
handles; signing in unlocks saving, bookmarks, reminders and recommendation history.

**6. Shareable profile card.** A branded 1200×630 card in four themes, downloadable as PNG and
shareable to LinkedIn, X and WhatsApp. Public profiles are **off by default**.

---

## Screenshots

> Replace these placeholders with real captures before submitting.
> `docs/screenshots/README.md` lists the exact filenames to use and how to force the stale-data badge
> to appear for the reliability screenshot.

| View | Screenshot |
| --- | --- |
| Landing page (animated hero) | `docs/screenshots/landing.png` |
| Problem browser with filters | `docs/screenshots/problems.png` |
| Unified dashboard | `docs/screenshots/dashboard.png` |
| Practice next (recommender) | `docs/screenshots/practice.png` |
| Contest calendar | `docs/screenshots/contests.png` |
| Share card (4 themes) | `docs/screenshots/share-card.png` |
| Stale-data badge during an outage | `docs/screenshots/stale-badge.png` |

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  CLIENT  ·  React 18 + Vite + Tailwind + TanStack Query + Framer Motion  │
│                                                                          │
│  pages/          LandingPage ProblemsPage PracticePage ContestsPage       │
│                  ProfilePage PublicProfilePage RemindersPage             │
│                  LoginPage RegisterPage SettingsPage NotFoundPage        │
│  context/        AuthContext (session)  ThemeContext  ToastContext       │
│  api/            axios instance: withCredentials + single-flight refresh │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │  JSON over HTTPS
                                │  auth = httpOnly cookies (access + refresh)
┌───────────────────────────────▼──────────────────────────────────────────┐
│  SERVER  ·  Node + Express 5 (ES modules)                                │
│                                                                          │
│  routes/       → validate (Zod) → controllers/ → services/               │
│  middleware/   helmet · cors · rate limits · origin check · errorHandler │
│                                                                          │
│  services/                                                               │
│    ├── sources/          codeforces · leetcode · codechef · clist        │
│    │                     (each behind a rate-limited request queue)      │
│    ├── snapshot          stale-while-error core + per-platform isolation │
│    ├── problem/problemSync/userActivity                                  │
│    ├── topicScoring      pure, testable strength model                   │
│    ├── recommender       weak topics → target rating window → problems   │
│    ├── profile/profileAggregation                                        │
│    ├── contest/reminder/email/shareCard                                  │
│    └── sourceHealth      powers GET /api/health                          │
│                                                                          │
│  jobs/   node-cron: problem sync (6h) · contest sync (15m) · reminders (1m)│
│  utils/  requestQueue · retry(backoff) · cache(node-cache) · ics · logger │
└──────┬──────────────────────────────────┬────────────────────────────────┘
       │                                  │
┌──────▼───────────────┐      ┌───────────▼─────────────────────────────────┐
│  MongoDB (Mongoose)  │      │  Third-party sources                        │
│                      │      │                                             │
│  users               │      │  Codeforces API      official, ~1 req / 2s  │
│  platformhandles     │      │  LeetCode GraphQL    unofficial             │
│  problems            │      │  CodeChef profile    unofficial (HTML)      │
│  bookmarknotes       │      │  clist.by            optional aggregator    │
│  contests  (cache)   │      └─────────────────────────────────────────────┘
│  reminders           │
│  profilesnapshots    │  ← every validated response is snapshotted here
│  recommendationhistory│
│  sourcehealth        │
│  unmappedtags        │
└──────────────────────┘
```

### Request flow for third-party data

```text
request → node-cache (TTL) ─hit→ respond { stale: false }
             │ miss
             ▼
        live fetch (queued, retried with backoff)
             │
      ┌──────┴───────┐
   success         failure / timeout / changed shape
      │                     │
  validate shape      read last snapshot from MongoDB
      │                     │
  write snapshot       ┌────┴────┐
      │            found      missing
      ▼              │            │
{ stale: false }  { stale: true }  503 with a clear message
```

Every third-party-backed endpoint returns the same envelope:

```json
{ "data": {}, "stale": false, "fetchedAt": "2026-09-24T12:00:00.000Z", "source": "codeforces:profile" }
```

---

## Project structure

```text
CodeHub/
├── package.json                 # npm workspaces root
├── README.md
├── .env.example                 # points at the real per-workspace examples
│
├── client/
│   ├── index.html
│   ├── vite.config.js           # dev proxy keeps /api same-origin for cookies
│   ├── tailwind.config.js       # design tokens, glass, gradients, keyframes
│   └── src/
│       ├── api/                 # axios + one module per resource
│       ├── app/                 # router, providers, query client
│       ├── components/
│       │   ├── common/          # ErrorBoundary, Motion, CommandPalette, …
│       │   ├── contests/  landing/  practice/  problems/  profile/
│       │   ├── settings/  share/
│       │   └── ui/              # Button, Card, Input, Badge, Modal, …
│       ├── context/             # Auth, Theme, Toast
│       ├── hooks/               # queries, countdown, debounce, reduced motion
│       ├── pages/               # one per route
│       ├── styles/index.css     # paper/ink theme tokens, IBM Plex fonts, a11y
│       └── utils/               # cn, format, platform, safeRedirect
│
└── server/
    ├── server.js  app.js  jest.config.js  .env.example
    ├── config/     env.js  db.js  constants.js  taxonomy.js
    ├── routes/     one router per resource, mounted in routes/index.js
    ├── controllers/
    ├── services/   business logic; services/sources/* wrap the platforms
    ├── models/     Mongoose schemas
    ├── middleware/ authenticate, validate, rateLimiters, errorHandler
    ├── jobs/       node-cron registry + three jobs
    ├── validators/ Zod schemas
    ├── scripts/    seedProblems, runProblemSync, runContestSync, smoke
    ├── utils/
    └── tests/      unit/ + integration/ (Jest + Supertest)
```

---

## The canonical taxonomy

`server/config/taxonomy.js` is the single source of truth. Each canonical topic lists its aliases per
platform:

```js
{
  key: 'dynamic-programming',
  name: 'Dynamic Programming',
  short: 'DP',
  accent: '#818cf8',
  aliases: {
    codeforces: ['dp', 'dynamic programming'],
    leetcode:   ['Dynamic Programming', 'Memoization'],
    codechef:   ['dynamic-programming', 'dp'],
  },
}
```

`normalizeTags(platform, rawTags)` is used by the problem sync, the browser, the dashboard, the radar
chart, the heatmaps and the recommender — nothing reads raw tags directly for analytics.

Rules:

- Mapping is **many-to-one**: several raw tags collapse into one canonical topic.
- Matching ignores case and punctuation (`Heap (Priority Queue)` → `heap priority queue`).
- Both `rawTags` and `canonicalTopics` are stored on every problem, so the UI can show either.
- An unknown tag resolves to `Other` **and** is recorded in the `unmappedtags` collection, so the
  mapping can be extended deliberately instead of silently losing data.
- Tags that are real but not algorithmic (LeetCode's `Database`, `Shell`, `Concurrency`) map to
  `Other` on purpose and are *not* reported as gaps.

To extend the taxonomy: add the raw tag to the right topic's `aliases` list. Nothing else changes.

---

## The recommender formula

Each canonical topic gets one explainable score in `[0, 1]`:

```text
score = 0.50 × volume  +  0.30 × difficulty  +  0.20 × recency
```

| Component | Definition | Rationale |
| --- | --- | --- |
| `volume` | `min(1, solved / 40)` | 40 solved problems in a topic is treated as full marks. |
| `difficulty` | `clamp((avgSolvedRating − 800) / (2400 − 800), 0, 1)` | 30 easy solves is not mastery. Unknown rating (LeetCode-only topics) scores a neutral `0.5` and is flagged, rather than silently counting as zero. |
| `recency` | `0.5 ^ (daysSinceLastSolve / 45)` | Skill decays. A topic untouched for 45 days keeps half its recency credit. |

Selecting what to recommend:

1. A topic is **active** only at **≥ 3 solved problems**. Below that it is *unexplored*, not *weak* —
   lumping the two together would bury the real gaps behind a wall of never-touched topics.
2. The **3 weakest active topics** are chosen. Never-attempted topics are surfaced separately as
   *"Never attempted"*, and 1–2-solve topics as low-activity.
3. Target difficulty is the user's level **+100 to +200 rating**. Level comes from the Codeforces
   rating; failing that a scaled LeetCode contest rating; failing that an estimate from solve volume;
   failing that `1200`.
4. Candidate problems are filtered to **unsolved** (from real submission history) and
   **not marked done** (from bookmarks), then ordered by popularity and shuffled within the band so
   *Shuffle* returns a genuinely different draw.
5. If the ideal rating window is empty, it widens in documented steps — but in-window problems are
   **always** used first, and any widened card is labelled as such in the UI.
6. For LeetCode, which has no per-problem rating, difficulty steps up one tier from what the user
   mostly solves (Easy → Medium → Hard).

All constants live in `server/config/constants.js` under `RECOMMENDER`, and the maths is unit tested
in `server/tests/unit/topicScoring.test.js`.

---

## Reliability: stale-while-error

LeetCode and CodeChef have no official public API. They *will* fail — possibly during a demo. The
design assumes that from the start:

- Every **validated** third-party response is written to `profilesnapshots` with `fetchedAt`, `source`
  and a `kind` (`profile` / `activity`), so profile stats and submission history never overwrite each
  other.
- Response **shape is validated before the write**, so a changed or broken payload can never replace a
  good snapshot.
- On failure the API serves the last good snapshot with `stale: true` and a `staleReason`
  (`source-unavailable` or `source-shape-changed`). The UI shows a **“Last updated 3h ago”** badge.
- A confirmed *"no such handle"* stays a real 404 — serving stale data for a typo would be misleading.
- Platforms are fetched with `Promise.allSettled`, so one platform failing degrades exactly one card.
- Contests are read from MongoDB, which *is* their cache, so the calendar works even with every source
  down.
- `GET /api/health` reports the last success, last error and consecutive failures per source, and
  answers even when MongoDB is unreachable.

---

## Reminders that cannot double-send

The worker never reads a row and then writes it. It performs one atomic update:

```js
findOneAndUpdate(
  { status: 'scheduled', dueAt: { $lte: now } },
  { $set: { status: 'claimed', claimedAt: now }, $inc: { attempts: 1 } },
  { new: true, sort: { dueAt: 1 } },
)
```

Only the worker that wins the update owns the send, so duplicate delivery is impossible even with
several server instances or a restart mid-send. Around that:

- a failed send returns the row to `scheduled` and is retried on the **next** tick (not immediately,
  which would burn all three attempts against an SMTP server that is still down);
- after 3 attempts the reminder is marked `failed` and left alone;
- a row stranded in `claimed` by a crashed process is requeued after a 10-minute grace period;
- a reminder whose contest already started is marked `skipped` rather than sent late;
- reminder emails carry an `.ics` attachment and a Google Calendar link.

Verified in `server/tests/integration/reminders.test.js`, including two workers draining the queue
concurrently.

---

## Data model

| Collection | Purpose | Key indexes |
| --- | --- | --- |
| `users` | Account, preferences, public-profile settings, hashed refresh sessions | unique `usernameLower`, unique `email` |
| `platformhandles` | A user's handle per platform | unique `{userId, platform}`, unique `{platform, normalizedHandle}` |
| `problems` | Shared problem corpus with `rawTags` + `canonicalTopics` | unique `{platform, externalId}`, `{canonicalTopics, rating}`, text index on `name`/`externalId` |
| `bookmarknotes` | Per-user bookmark, note and done flag | unique `{userId, problemId}` |
| `contests` | Contest cache / snapshot, all times UTC | unique `{platform, externalId}`, `{startTime}` |
| `reminders` | Scheduled notifications with claim state | `{status, dueAt}`, unique `{userId, contestId, offsetKey}` |
| `profilesnapshots` | Last good third-party payload | unique `{platform, normalizedHandle, kind}` |
| `recommendationhistory` | What was recommended, and why | `{userId, generatedAt}` |
| `sourcehealth` | Per-source success/failure ledger | unique `source` |
| `unmappedtags` | Taxonomy gaps to review | unique `{platform, rawTag}` |

---

## API reference

All routes are under `/api`. Third-party-backed responses include `{ stale, fetchedAt, source }`.

### Auth
| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/register` | Sets httpOnly access + refresh cookies |
| `POST` | `/auth/login` | Accepts email **or** username |
| `POST` | `/auth/refresh` | Rotates the refresh token; replay is rejected |
| `POST` | `/auth/logout` | Revokes that one session |
| `GET` | `/auth/me` | Current user |
| `PATCH` | `/auth/password` | Changes password and revokes all sessions |
| `PATCH` | `/users/me` | Profile, preferences, public-sharing settings |

### Handles, problems, practice
| Method | Path | Notes |
| --- | --- | --- |
| `GET` `PUT` `DELETE` | `/handles`, `/handles/:platform` | Link/unlink; verification is best-effort |
| `GET` | `/problems` | Filters: `platform, topics, rawTags, difficulties, ratingMin, ratingMax, includeUnrated, divisions, minSolvedCount, search, status, sort, page, limit, handle` |
| `GET` | `/problems/facets` | Topic counts, rating bounds, divisions |
| `GET` | `/problems/raw-tags` | Raw platform tags with counts |
| `GET` | `/problems/progress` | Topic-wise solved progress |
| `POST` | `/problems/sync` | Manual sync (auth + rate limited) |
| `GET` | `/problems/bookmarks` | Saved problems with notes |
| `PATCH` `DELETE` | `/problems/:problemId/bookmark` | Bookmark, note, done |
| `GET` | `/recommendations` | `topics, count, difficultyOffset, platform, shuffle` |
| `GET` | `/recommendations/history` | Previous suggestions |

### Profile, contests, reminders, sharing
| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/profile` | `?codeforces=&leetcode=&codechef=` or the signed-in user's handles |
| `POST` | `/profile/refresh` | Force refetch, with a per-user cooldown |
| `GET` | `/contests` | `platforms, status, from, to, minDurationHours, maxDurationHours, limit` |
| `GET` | `/contests/:id/ics` | Downloadable calendar file (`?reminderMinutes=`) |
| `POST` | `/contests/sync` | Manual sync (auth + rate limited) |
| `GET` `POST` `DELETE` | `/reminders`, `/reminders/:id` | List, create, cancel |
| `GET` | `/public/:username` | Public profile (404 unless sharing is on) |
| `GET` | `/card/:username.png` | Server-rendered share card (`?theme=`) |
| `GET` | `/taxonomy` | Canonical topics for the client |
| `GET` | `/health` | Per-source status; answers without MongoDB |
| `GET` | `/share/:username` | **Outside `/api`** — HTML with per-user `og:*` tags for crawlers |

---

## Getting started

### Prerequisites

- **Node.js 20+** (developed on Node 26)
- **MongoDB** — local `mongod`, Docker, or a free MongoDB Atlas cluster

### 1. Install

```bash
git clone <your-repo-url> CodeHub
cd CodeHub
npm install          # npm workspaces installs both client and server
```

### 2. Configure

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and set at minimum:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/codehub
JWT_ACCESS_SECRET=<32+ random chars>
JWT_REFRESH_SECRET=<a different 32+ random chars>
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`CLIST_*` and `SMTP_*` are optional — see [Environment variables](#environment-variables).

### 3. Seed some data

```bash
# Offline seed: ~60 real problems, no network needed. Good for a demo.
npm run seed --workspace=server

# Or pull the full Codeforces problemset + LeetCode topic list (needs network):
npm run sync:problems --workspace=server
npm run sync:contests --workspace=server
```

### 4. Run

```bash
npm run dev        # API on :5000, client on :5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the backend, which keeps the auth
cookies first-party in development.

### 5. Verify

```bash
npm test --workspace=server            # 159 Jest tests
npm run smoke --workspace=server       # boots the real server and probes it
npm run build --workspace=client       # production build
```

---

## Environment variables

### `server/.env`

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | |
| `PORT` | no | `5000` | |
| `CLIENT_URL` | no | `http://localhost:5173` | CORS origin + links in emails. Comma-separate for several. |
| `SERVER_URL` | no | `http://localhost:5000` | Used for absolute share-card URLs |
| `MONGODB_URI` | **yes** | — | Local or Atlas |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | **yes** | — | ≥ 32 chars, different from above |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | no | `15m` / `30d` | |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | no | `false` / `lax` / empty | Set `true` / `none` for split-domain production |
| `CODEFORCES_MIN_INTERVAL_MS` | no | `2100` | Keep ≥ 2000 to respect Codeforces |
| `CLIST_USERNAME` / `CLIST_API_KEY` | no | empty | Without them, LeetCode/CodeChef contests come from cache only |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | no | empty | Without `SMTP_HOST`, reminder emails are logged to the console instead of sent — the whole flow stays testable |
| `ENABLE_CRON` | no | `true` | Set `false` to disable background jobs |
| `PROBLEM_SYNC_CRON` / `CONTEST_SYNC_CRON` / `REMINDER_CRON` | no | `0 */6 * * *` / `*/15 * * * *` / `* * * * *` | |
| `CACHE_TTL_SECONDS` | no | `300` | node-cache default TTL |
| `PROFILE_REFRESH_COOLDOWN_SECONDS` | no | `120` | Manual dashboard refresh cooldown |

Invalid configuration fails fast: `server/config/env.js` validates everything with Zod at boot and
prints exactly which variable is wrong.

### `client/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000` | Used in production builds; dev uses the Vite proxy |
| `VITE_PORT` | `5173` | Dev server port |

### Getting a clist.by key (optional)

1. Sign in at <https://clist.by/>.
2. Open <https://clist.by/api/v4/doc/> while signed in and use the API-key link in the
   **Authentication** section.
3. Put the username and key in `server/.env`. Either the bare key or the full
   `ApiKey username:key` string from the docs page works. The documented request limit is
   10/minute, which the adapter respects with a 6.5-second queue interval.

Without a key, Codeforces contests still come live from its official API and everything else is served
from the MongoDB cache.

---

## Scripts

Run from the repository root:

| Command | What it does |
| --- | --- |
| `npm run dev` | API + client together |
| `npm run dev:server` / `npm run dev:client` | One at a time |
| `npm run build` | Production client build |
| `npm start` | Start the API (production mode) |
| `npm test` | Server test suite |
| `npm run lint` | ESLint over both workspaces |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm run smoke` | Boot the real server against a temporary in-memory MongoDB and probe it |
| `npm run verify` | lint + tests + production build, in one go |
| `npm run seed` | Offline problem seed |

Workspace-scoped:

| Command | What it does |
| --- | --- |
| `npm run sync:problems --workspace=server` | Pull the Codeforces problemset + LeetCode topics |
| `npm run sync:contests --workspace=server` | Refresh the contest cache |
| `npm run test:watch --workspace=server` | Jest in watch mode |

---

## Tests

```bash
npm run verify        # lint both workspaces, run the tests, build the client
npm test              # tests only
npm run lint          # lint only
```

### Linting

Both workspaces use ESLint 9 flat configs and are clean with zero warnings.

The client config enables `eslint-plugin-react-hooks` v7, whose compiler-aware rules
(`set-state-in-effect`, `purity`) are stricter than the classic ones. Every component here satisfies
them without suppressions: form state is reset by remounting with a `key`, external stores are read
through `useSyncExternalStore`, and derived values are computed rather than mirrored into state with an
effect. There is exactly one inline suppression in the codebase — `autoFocus` in the command palette,
where focusing the search field is the expected behaviour for a deliberately-opened dialog.

### Test suite

159 tests across 11 suites. Jest runs the server's native ES modules
(`NODE_OPTIONS=--experimental-vm-modules`). Integration tests use `mongodb-memory-server`, so **no
local MongoDB is needed** and index constraints, atomic updates and aggregations are all exercised for
real.

| Suite | Covers |
| --- | --- |
| `unit/taxonomy.test.js` | Alias normalisation across platforms, unmapped-tag reporting, catalogue integrity (no raw tag maps to two topics) |
| `unit/topicScoring.test.js` | Each scoring component, the weighting, the activity threshold, weak vs never-attempted |
| `unit/profileAggregation.test.js` | Heatmap merging, streaks, cross-platform topic combination, level estimation |
| `unit/snapshotFallback.test.js` | Live success, stale fallback, changed shape not overwriting a good snapshot, 404 passthrough, per-platform isolation |
| `integration/health.test.js` | `/api/health` answers without a database |
| `integration/auth.test.js` | Registration, bcrypt storage, login, refresh rotation + replay rejection, logout, origin blocking |
| `integration/problems.test.js` | Every filter, sort, facets, raw tags, bookmarks and notes |
| `integration/recommendations.test.js` | Weak-topic selection from real history, rating window, solved/done exclusion, explanations |
| `integration/reminders.test.js` | **No double sends** (including two concurrent workers), retry/give-up, stuck-claim recovery, skip-if-started |
| `integration/contests.test.js` | Filters, phase recomputation, stale reporting, `.ics` output |
| `integration/shareCard.test.js` | PNG rasterisation, all four themes, privacy (private → 404), OG tags |

---

## Deployment

The recommended setup is **Vercel for the frontend and Render for the API**, with Vercel forwarding
`/api/*` to Render. The browser only ever talks to the Vercel address, so the login cookies are
first-party and work in every browser, including Safari and iOS. Pointing the frontend straight at
`onrender.com` instead would make them third-party cookies, which Safari, Brave and Chrome Incognito
block.

```text
browser ──▶ your-app.vercel.app ──┬─ /, /practice, /u/... ─▶ static React build
                                  ├─ /api/*, /share/*      ─▶ codehub-api.onrender.com
                                  └─ /u/:username (bots)   ─▶ codehub-api.onrender.com/share/:username
```

All of this routing lives in [`client/vercel.json`](client/vercel.json).

### 1. Database — MongoDB Atlas

1. Create a free M0 cluster and a database user.
2. Network Access: Render's free plan has no fixed outbound IP, so allow `0.0.0.0/0`. The database
   is then protected by its username and password only.
3. Copy the connection string into `MONGODB_URI`, including the database name.

Indexes are created automatically at boot in production (`syncIndexes()`).

### 2. API — Render (web service)

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm ci --workspace=server` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Environment variables:

```bash
NODE_ENV=production
NODE_VERSION=22
MONGODB_URI=<atlas uri>
JWT_ACCESS_SECRET=<random, 32+ chars>      # openssl rand -hex 32
JWT_REFRESH_SECRET=<different random>
CLIENT_URL=https://your-app.vercel.app     # exact production address; used for CORS and CSRF checks
SERVER_URL=https://codehub-api.onrender.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax                        # same-site thanks to the Vercel proxy
TRUST_PROXY=2                              # Vercel + Render's balancer, so rate limits see the visitor's IP
ENABLE_CRON=true
CLIST_USERNAME=... / CLIST_API_KEY=...     # optional, for LeetCode and CodeChef contests
GOOGLE_CLIENT_ID=... / GOOGLE_CLIENT_SECRET=...   # optional, enables "Continue with Google"
```

Render's free instance sleeps after 15 idle minutes and takes about a minute to wake. The client
waits up to 90 seconds and shows a "waking up the server" notice meanwhile. Cron jobs (contest
sync, reminder emails) pause while it sleeps; use a paid instance or an uptime pinger if reminders
must be reliable.

`TRUST_PROXY=2` trusts the IP that Vercel forwards. Someone calling `onrender.com` directly could
fake that header to dodge the per-IP limits, so failed logins are also limited per account.

### 3. Frontend — Vercel

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | none (leave `VITE_API_URL` unset) |

Before deploying, set the Render address in the three `destination` fields of
`client/vercel.json` if your service is not called `codehub-api`.

### Google sign-in (optional)

CodeHub uses the OAuth 2.0 **authorization code flow with PKCE**, handled entirely server-side:
the client secret never reaches the browser and no Google JavaScript is loaded. The redirect URI
points at the *frontend's* origin, which Vercel forwards to Render, so the session cookie stays
first-party.

```text
/login ──▶ /api/auth/google ──▶ accounts.google.com ──▶ /api/auth/google/callback ──▶ /
           (sets a signed, 10-minute state + PKCE cookie)   (verifies state, exchanges code)
```

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
   create an **OAuth client ID** of type **Web application**.
2. Add these **Authorised redirect URIs** exactly:
   ```text
   http://localhost:5173/api/auth/google/callback
   https://<your-vercel-domain>/api/auth/google/callback
   ```
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Render (and in
   `server/.env` for local development).

Account rules:

| Situation | Result |
| --- | --- |
| Google account already linked | signs in |
| Same **verified** email as an existing account | links Google to it, then signs in |
| No match | creates an account, with a username derived from the email |
| Email not verified by Google | refused — linking on an unverified address would be a takeover path |

Accounts created through Google have no password. Settings offers them "Set a password" (no current
password required, since the session already proves ownership) so they can later sign in either way.
Leaving the two variables blank disables the button cleanly; email/password login is unaffected.

### Single-service alternative

Express can also serve the built client itself (`server/app.js` picks up `client/dist`
automatically, including the crawler redirect for `/u/:username`):

```bash
npm run build && npm start
```

### Social previews

Share `https://your-app.vercel.app/u/username`. Link-preview bots (LinkedIn, X, WhatsApp, Slack,
Discord) are routed to `/share/username`, which returns per-user `og:*` and `twitter:*` tags and the
server-rendered card image. Check with LinkedIn's Post Inspector or:

```bash
curl -A "LinkedInBot/1.0" https://your-app.vercel.app/u/username
```

---

## Known limitations

**Unofficial APIs.** Only Codeforces publishes a documented public API. LeetCode is read through the
same GraphQL endpoint its website uses, and CodeChef is parsed out of its public profile HTML. Both
can change or start refusing traffic without notice. CodeHub mitigates this with snapshot fallback,
shape validation and honest stale badges — it cannot prevent it. If LeetCode changes its schema, the
adapter in `services/sources/leetcode.service.js` is the only file to update.

**CodeChef data is shallow.** The public profile page exposes rating, stars, ranks and solve counts,
but no per-problem topic data and no daily activity. CodeChef therefore contributes to totals and
ratings but not to the topic radar or the heatmap.

**LeetCode has no per-problem rating.** Difficulty is mapped to an approximate Codeforces-equivalent
band (Easy 1200 / Medium 1600 / Hard 2100) so both platforms can share one recommender. It is an
approximation, not a claim of equivalence.

**LeetCode solved-status is aggregate.** The public GraphQL profile exposes solved *counts* per
difficulty and per tag, not the list of solved slugs. Solved/Attempted marks in the problem browser
are therefore Codeforces-only.

**Codeforces rate limit.** Roughly 1 request per 2 seconds. A full problemset sync plus a profile
fetch takes a few seconds, which is why syncing is a background job and manual refresh has a cooldown.

**Contest coverage depends on clist.by.** Without a clist key, LeetCode and CodeChef contests come
only from whatever is already cached.

**Cron on sleeping hosts.** Minute-level reminder dispatch assumes a process that stays awake.

**React Router v6.** Pinned as required. v6 carries two moderate advisories that are only fixed in v7;
the one vector that applies to this app (open redirect through a user-controlled path) is neutralised
in `client/src/utils/safeRedirect.js`, and the SSR-hydration vector does not apply to this pure SPA.

**Tests do not hit the network.** External adapters are mocked or snapshot-backed by design, so a
real upstream schema change surfaces in the health endpoint and stale badges, not in CI.

---

## Future work

Deliberately out of scope for v1:

- **Google OAuth** sign-in (v1 is email + password only)
- **Browser push notifications** and a service worker (v1 uses email, Google Calendar links and `.ics`)
- **Friends leaderboard** and head-to-head comparison
- **Practice roadmaps** — ordered, multi-week topic curricula
- **Daily-problem streaks** with in-app accountability
- **PWA / offline mode**
- Editorial and submission-quality signals in the recommender
- An admin view over `unmappedtags` for one-click taxonomy extension

---

## Licence and attribution

Problem, contest and profile data belongs to Codeforces, LeetCode and CodeChef respectively. CodeHub
stores derived aggregates and cached snapshots for the purpose of showing a user their own progress.
Built for academic use.
