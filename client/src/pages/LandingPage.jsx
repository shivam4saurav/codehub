import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  LayoutDashboard,
  ListFilter,
  Lock,
  Share2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchHandles } from '../api/handles.api.js';
import { PageTransition } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import HeroPreview from '../components/landing/HeroPreview.jsx';
import QuickStartForm from '../components/practice/QuickStartForm.jsx';
import RecommendationRow from '../components/practice/RecommendationRow.jsx';
import Button from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useContestsQuery, useRemindersQuery } from '../hooks/useContests.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useRecommendationsQuery } from '../hooks/useRecommendations.js';
import cn from '../utils/cn.js';
import { formatDateTime } from '../utils/format.js';
import { getPlatform } from '../utils/platform.js';

/* ----------------------------------------------------------------- data */

/**
 * A static, clearly labelled example of what Practice next returns. The
 * problems and the reason format are real (same wording the recommender
 * produces), only the user is made up.
 */
const EXAMPLE = {
  level: 1350,
  target: '1450–1550',
  weakest: ['Dynamic Programming', 'Binary Search', 'Graphs'],
  items: [
    {
      id: 'ex-455A',
      platform: 'codeforces',
      externalId: '455A',
      name: 'Boredom',
      url: 'https://codeforces.com/problemset/problem/455/A',
      rating: 1500,
      topicName: 'Dynamic Programming',
      reason:
        'Dynamic Programming is one of your weaker active topics: 4 solved, avg rating 1150, last solved 41d ago.',
    },
    {
      id: 'ex-1873F',
      platform: 'codeforces',
      externalId: '1873F',
      name: 'Money Trees',
      url: 'https://codeforces.com/problemset/problem/1873/F',
      rating: 1500,
      topicName: 'Binary Search',
      reason:
        'Binary Search is one of your weaker active topics: 5 solved, avg rating 1200, last solved 19d ago.',
    },
    {
      id: 'ex-580C',
      platform: 'codeforces',
      externalId: '580C',
      name: 'Kefa and Park',
      url: 'https://codeforces.com/problemset/problem/580/C',
      rating: 1500,
      topicName: 'Graphs',
      reason:
        'Graphs is one of your weaker active topics: 3 solved, avg rating 1100, last solved 63d ago.',
    },
  ],
};

const HOW_IT_WORKS = [
  {
    title: 'Reads your history',
    body: 'Every problem you have solved on Codeforces or LeetCode, sorted into 26 topics that mean the same thing on both sites.',
  },
  {
    title: 'Scores each topic',
    body: 'How many you solved, how hard they were and how long ago. A topic needs 3 solves before it can count as weak.',
  },
  {
    title: 'Picks the next problems',
    body: 'Unsolved ones from your weakest topics, rated 100–200 above your level, each with the reason it was picked.',
  },
];

const OTHER_PAGES = [
  {
    to: '/profile',
    icon: LayoutDashboard,
    label: 'My dashboard',
    body: 'Ratings, solved counts and one activity calendar for Codeforces, LeetCode and CodeChef.',
  },
  {
    to: '/problems',
    icon: ListFilter,
    label: 'Problems',
    body: 'Filter problems by topic, rating or difficulty. Bookmark them and keep notes.',
  },
  {
    to: '/contests',
    icon: CalendarClock,
    label: 'Contest calendar',
    body: 'Upcoming contests from all three sites in your local time, with calendar links.',
  },
  {
    to: '/reminders',
    icon: BellRing,
    label: 'Contest reminders',
    body: 'An email 1 day, 1 hour or 15 minutes before a contest starts.',
    requiresAuth: true,
  },
  {
    to: '/settings#sharing',
    icon: Share2,
    label: 'Share card',
    body: 'A public profile page and an image you can post on LinkedIn.',
    requiresAuth: true,
  },
];

/* --------------------------------------------------------------- pieces */

const UpcomingContestRow = ({ contest }) => {
  const platform = getPlatform(contest.platform);
  const countdown = useCountdown(contest.startTime);

  return (
    <li className="flex items-baseline gap-3 py-2.5">
      <span
        className="w-8 shrink-0 font-mono text-[11px] font-medium"
        style={{ color: platform.accent }}
      >
        {platform.short}
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={contest.url}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring block truncate rounded text-sm text-content-primary hover:underline"
        >
          {contest.name}
        </a>
        <p className="text-xs text-content-muted">{formatDateTime(contest.startTime)}</p>
      </div>
      <span className="shrink-0 font-mono text-xs text-content-secondary tabular">
        {contest.phase === 'coding' ? 'live' : countdown.hasPassed ? 'starting' : countdown.label}
      </span>
    </li>
  );
};

const UpcomingContests = () => {
  // Same params as the Contest calendar's default view, so the cache is shared.
  const { data, isLoading, error } = useContestsQuery({ status: 'upcoming', platforms: [] });
  const contests = (data?.items ?? []).slice(0, 5);

  return (
    <section aria-labelledby="upcoming-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="upcoming-heading" className="text-base font-semibold text-content-primary">
          Coming up
        </h2>
        <Link to="/contests" className="text-link text-sm">
          All contests
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-2" role="status" aria-label="Loading contests">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="py-2 text-sm text-content-muted">Contests could not be loaded right now.</p>
      ) : contests.length === 0 ? (
        <p className="py-2 text-sm text-content-muted">No upcoming contests found yet.</p>
      ) : (
        <ul className="divide-y divide-edge border-y border-edge">
          {contests.map((contest) => (
            <UpcomingContestRow key={contest.id} contest={contest} />
          ))}
        </ul>
      )}
    </section>
  );
};

const ExamplePanel = () => (
  <figure className="glass overflow-hidden">
    <figcaption className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
      <span className="text-sm font-medium text-content-primary">
        Next up for a {EXAMPLE.level}-rated user
      </span>
      <span className="font-mono text-[11px] text-content-muted">example</span>
    </figcaption>

    <p className="border-b border-edge bg-surface-inset/60 px-4 py-2.5 font-mono text-xs text-content-muted">
      weakest: {EXAMPLE.weakest.join(' · ').toLowerCase()}
    </p>

    <ol className="divide-y divide-edge">
      {EXAMPLE.items.map((item) => (
        <RecommendationRow key={item.id} item={item} compact />
      ))}
    </ol>

    <p className="border-t border-edge px-4 py-2.5 font-mono text-xs text-content-muted">
      target {EXAMPLE.target} · already-solved problems skipped
    </p>
  </figure>
);

/* ---------------------------------------------------------------- guest */
const SUPPORTED = ['codeforces', 'leetcode', 'codechef'];

const SectionHeading = ({ id, eyebrow, title, body }) => (
  <div className="mx-auto max-w-2xl text-center">
    <p className="eyebrow">{eyebrow}</p>
    <h2 id={id} className="mt-2 text-balance text-3xl font-bold tracking-tight text-content-primary">
      {title}
    </h2>
    {body ? <p className="mt-3 text-content-secondary">{body}</p> : null}
  </div>
);

const GuestHome = () => (
  <>
    {/* Hero */}
    <section className="relative overflow-hidden px-4 pb-24 pt-14 sm:px-6 lg:px-8 lg:pt-20">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgb(249_115_22/0.12),transparent_65%)]"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">for Codeforces, LeetCode and CodeChef</p>
        <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-content-primary sm:text-6xl">
          Know what to <span className="gradient-text">solve next.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-content-secondary sm:text-xl">
          Code<span className="font-semibold text-brand-300">Hub</span> reads the problems you have
          already solved, finds the topics you keep avoiding, and picks unsolved ones a little above
          your rating.
        </p>
        <div className="mx-auto mt-8 max-w-xl text-left">
          <QuickStartForm />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button as={Link} to="/contests" variant="secondary" icon={CalendarClock}>
            Contest calendar
          </Button>
          <Button as={Link} to="/register" variant="ghost" iconRight={ArrowRight}>
            Create a free account
          </Button>
        </div>
      </div>

      <HeroPreview className="mt-16" />
    </section>

    {/* Supported platforms */}
    <section aria-label="Supported platforms" className="border-y border-edge bg-surface-raised">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6">
        <span className="text-sm text-content-muted">Works with</span>
        {SUPPORTED.map((key) => {
          const platform = getPlatform(key);
          return (
            <span key={key} className="flex items-center gap-2 text-base font-semibold text-content-primary">
              <span
                className="grid h-7 w-7 place-items-center rounded-lg font-mono text-[11px] font-bold text-white"
                style={{ background: platform.accent }}
                aria-hidden="true"
              >
                {platform.short}
              </span>
              {platform.label}
            </span>
          );
        })}
      </div>
    </section>

    <div className="mx-auto w-full max-w-6xl space-y-24 px-4 py-20 sm:px-6 lg:px-8">
      {/* How it works */}
      <section aria-labelledby="how-heading">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From solve history to your next problem"
          body="No guessing which topic to grind. Three steps, all from data you already have."
        />
        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="glass card-hover p-6">
              <p className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 font-mono text-sm font-bold text-brand-300">
                {index + 1}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-content-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-content-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Example output */}
      <section
        aria-labelledby="example-heading"
        className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
      >
        <div>
          <p className="eyebrow">Practice next</p>
          <h2 id="example-heading" className="mt-2 text-3xl font-bold tracking-tight text-content-primary">
            Every pick comes with a reason
          </h2>
          <p className="mt-3 leading-relaxed text-content-secondary">
            You see why a problem was chosen: which weak topic it trains, how many you have solved
            there and how long ago. Problems you already solved are skipped.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-content-secondary">
            {[
              'Rated 100–200 above your current level',
              'Topics match across Codeforces and LeetCode',
              'No account needed to try it',
            ].map((point) => (
              <li key={point} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-300">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <ExamplePanel />
      </section>

      {/* Everything else */}
      <section aria-labelledby="also-heading">
        <SectionHeading
          id="also-heading"
          eyebrow="Also in CodeHub"
          title="One place for your whole CP routine"
        />
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_PAGES.map((page) => (
            <li key={page.to} className="min-w-0">
              <Link to={page.to} className="glass card-hover focus-ring group flex h-full flex-col p-6">
                <span className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                    <page.icon size={18} aria-hidden="true" />
                  </span>
                  {page.requiresAuth ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-inset px-2 py-0.5 text-[11px] text-content-muted">
                      <Lock size={10} aria-hidden="true" />
                      Account
                    </span>
                  ) : null}
                </span>
                <span className="mt-4 text-base font-semibold text-content-primary">{page.label}</span>
                <span className="mt-1.5 flex-1 text-sm leading-relaxed text-content-secondary">{page.body}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-300">
                  Open
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
          <li className="glass min-w-0 p-6 sm:col-span-2 lg:col-span-1">
            <UpcomingContests />
          </li>
        </ul>
      </section>

      {/* Closing call to action */}
      <section className="overflow-hidden rounded-3xl bg-[#18181b] px-6 py-14 text-center sm:px-12">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Stop guessing what to practise.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">
          Save your usernames, bookmark problems and get contest reminders by email.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button as={Link} to="/register" size="lg" iconRight={ArrowRight}>
            Create a free account
          </Button>
          <Button
            as={Link}
            to="/login"
            size="lg"
            variant="outline"
            className="border-zinc-600 text-white hover:bg-white/10"
          >
            Sign in
          </Button>
        </div>
      </section>
    </div>
  </>
);

/* ------------------------------------------------------------ signed in */

/** What is left to set up. Disappears once everything is done. */
const SetupList = ({ steps }) => {
  const remaining = steps.filter((step) => !step.done);
  if (remaining.length === 0) return null;

  return (
    <section aria-labelledby="setup-heading">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="setup-heading" className="text-base font-semibold text-content-primary">
          Finish setting up
        </h2>
        <span className="font-mono text-xs text-content-muted">
          {steps.length - remaining.length}/{steps.length} done
        </span>
      </div>
      <ul className="divide-y divide-edge border-y border-edge">
        {steps.map((step) => (
          <li key={step.title} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                step.done
                  ? 'border-state-success bg-state-success text-white'
                  : 'border-edge-strong bg-surface-raised',
              )}
              aria-hidden="true"
            >
              {step.done ? <Check size={11} strokeWidth={3} /> : null}
            </span>
            <span
              className={cn(
                'flex-1 text-sm',
                step.done ? 'text-content-secondary' : 'text-content-primary',
              )}
            >
              {step.title}
              <span className="sr-only">{step.done ? ' (done)' : ' (not done)'}</span>
            </span>
            {!step.done ? (
              <Link to={step.to} className="text-link shrink-0 text-sm">
                {step.action}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};

const NextUp = ({ platform, enabled, onlyCodeChef }) => {
  const { data, isLoading, error, refetch } = useRecommendationsQuery(
    { platform, count: 5, topics: [] },
    { enabled },
  );

  if (onlyCodeChef) {
    return (
      <div className="glass p-5 text-sm text-content-secondary">
        Practice next works from Codeforces or LeetCode history. Add one of those usernames in{' '}
        <Link to="/settings#usernames" className="text-link">
          Settings
        </Link>
        .
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="glass p-5 sm:p-6">
        <h2 className="text-base font-semibold text-content-primary">Add a username to start</h2>
        <p className="mt-1 text-sm text-content-secondary">
          CodeHub needs your Codeforces or LeetCode username to see what you have solved.
        </p>
        <Button as={Link} to="/settings#usernames" size="sm" className="mt-4" iconRight={ArrowRight}>
          Add usernames
        </Button>
      </div>
    );
  }

  return (
    <div>
      {data?.weakTopics?.length > 0 ? (
        <p className="mb-3 font-mono text-xs text-content-muted">
          weakest: {data.weakTopics.map((topic) => topic.name.toLowerCase()).join(' · ')}
        </p>
      ) : null}

      {error ? (
        <div className="glass p-5 text-sm text-content-secondary">
          Could not pick problems right now.{' '}
          <button type="button" onClick={() => refetch()} className="text-link">
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="glass divide-y divide-edge" role="status" aria-label="Loading problems">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="glass p-5 text-sm text-content-secondary">
          Nothing unsolved in your range right now.{' '}
          <Link to="/practice" className="text-link">
            Try another difficulty
          </Link>
        </div>
      ) : (
        <ol className="glass divide-y divide-edge">
          {data.items.map((item) => (
            <RecommendationRow key={item.id} item={item} compact />
          ))}
        </ol>
      )}

      <Link to="/practice" className="text-link mt-3 inline-block text-sm">
        More options in Practice next
      </Link>
    </div>
  );
};

const SignedInHome = ({ user }) => {
  const handlesQuery = useQuery({
    queryKey: ['handles'],
    queryFn: fetchHandles,
    staleTime: 60_000,
  });
  const remindersQuery = useRemindersQuery();

  const linked = new Set((handlesQuery.data ?? []).map((row) => row.platform));
  const platform = linked.has('codeforces') ? 'codeforces' : 'leetcode';
  const canRecommend = linked.has('codeforces') || linked.has('leetcode');

  const hasReminder = (remindersQuery.data?.reminders ?? []).some((reminder) =>
    ['scheduled', 'claimed', 'sent'].includes(reminder.status),
  );

  const steps = [
    { done: linked.size > 0, title: 'Add your platform usernames', to: '/settings#usernames', action: 'Add' },
    { done: hasReminder, title: 'Set a reminder for a contest', to: '/contests', action: 'Pick a contest' },
    {
      done: Boolean(user.publicProfile?.enabled),
      title: 'Turn on your public profile (optional)',
      to: '/settings#sharing',
    icon: Share2,
      action: 'Turn on',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`@${user.username}`}
        title="Next up"
        description="Picked from your weakest topics, a little above your level. Solve one, then come back for the next."
        actions={
          <Button as={Link} to="/profile" variant="secondary" size="sm">
            My dashboard
          </Button>
        }
      />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {handlesQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <NextUp
            platform={platform}
            enabled={canRecommend}
            onlyCodeChef={linked.size > 0 && !canRecommend}
          />
        )}

        <div className="space-y-10">
          {handlesQuery.isLoading || remindersQuery.isLoading ? null : <SetupList steps={steps} />}
          <UpcomingContests />
        </div>
      </div>
    </>
  );
};

export const LandingPage = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <PageTransition>
      {isAuthenticated && user ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <SignedInHome user={user} />
        </section>
      ) : (
        <GuestHome />
      )}
    </PageTransition>
  );
};

export default LandingPage;
