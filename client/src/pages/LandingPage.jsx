import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchHandles } from '../api/handles.api.js';
import { PageTransition } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
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
    label: 'My dashboard',
    body: 'Ratings, solved counts and one activity calendar for Codeforces, LeetCode and CodeChef.',
  },
  {
    to: '/problems',
    label: 'Problems',
    body: 'Filter problems by topic, rating or difficulty. Bookmark them and keep notes.',
  },
  {
    to: '/contests',
    label: 'Contest calendar',
    body: 'Upcoming contests from all three sites in your local time, with calendar links.',
  },
  {
    to: '/reminders',
    label: 'Contest reminders',
    body: 'An email 1 day, 1 hour or 15 minutes before a contest starts.',
    requiresAuth: true,
  },
  {
    to: '/settings#sharing',
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

const GuestHome = () => (
  <>
    <section className="grid items-start gap-10 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pt-8">
      <div className="max-w-xl">
        <p className="eyebrow">for Codeforces and LeetCode</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-content-primary sm:text-5xl">
          Know what to solve next.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-content-secondary">
          CodeHub reads the problems you have already solved, finds the topics you keep avoiding,
          and picks unsolved ones a little above your rating.
        </p>

        <QuickStartForm className="mt-8" />

        <p className="mt-8 text-sm text-content-muted">
          Have an account?{' '}
          <Link to="/login" className="text-link">
            Sign in
          </Link>
          . New here?{' '}
          <Link to="/register" className="text-link">
            Create one
          </Link>{' '}
          to save your usernames and progress.
        </p>
      </div>

      <ExamplePanel />
    </section>

    <section aria-labelledby="how-heading" className="mt-16 border-t border-edge pt-10">
      <h2 id="how-heading" className="text-xl font-semibold text-content-primary">
        How it picks problems
      </h2>
      <ol className="mt-6 grid gap-8 md:grid-cols-3">
        {HOW_IT_WORKS.map((step, index) => (
          <li key={step.title}>
            <p className="font-mono text-sm text-brand-300">{index + 1}.</p>
            <h3 className="mt-1 text-base font-semibold text-content-primary">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>

    <div className="mt-16 grid gap-12 border-t border-edge pt-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <section aria-labelledby="also-heading">
        <h2 id="also-heading" className="text-base font-semibold text-content-primary">
          Also in CodeHub
        </h2>
        <ul className="mt-2 divide-y divide-edge border-y border-edge">
          {OTHER_PAGES.map((page) => (
            <li key={page.to}>
              <Link
                to={page.to}
                className="focus-ring group flex items-baseline gap-4 rounded py-3 transition-colors"
              >
                <span className="w-40 shrink-0 text-sm font-medium text-content-primary group-hover:underline">
                  {page.label}
                </span>
                <span className="flex-1 text-sm text-content-secondary">{page.body}</span>
                {page.requiresAuth ? (
                  <Lock size={12} className="shrink-0 text-content-muted" aria-label="Needs an account" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <UpcomingContests />
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
                'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border',
                step.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-edge-strong',
              )}
              aria-hidden="true"
            >
              {step.done ? <Check size={11} strokeWidth={3} /> : null}
            </span>
            <span
              className={cn(
                'flex-1 text-sm',
                step.done ? 'text-content-muted line-through' : 'text-content-primary',
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
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {isAuthenticated && user ? <SignedInHome user={user} /> : <GuestHome />}
      </section>
    </PageTransition>
  );
};

export default LandingPage;
