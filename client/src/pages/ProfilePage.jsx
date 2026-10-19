import { ArrowRight, CircleAlert, Layers, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageTransition } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import ActivityHeatmap from '../components/profile/ActivityHeatmap.jsx';
import HandleLookupForm from '../components/profile/HandleLookupForm.jsx';
import {
  CodeChefCard,
  CodeforcesCard,
  LeetCodeCard,
} from '../components/profile/PlatformCards.jsx';
import TopicRadar from '../components/profile/TopicRadar.jsx';
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx';
import Button from '../components/ui/Button.jsx';
import { ProgressBar } from '../components/ui/Progress.jsx';
import { SkeletonCard, SkeletonGrid } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState, StaleBadge } from '../components/ui/States.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfileQuery, useProfileRefresh } from '../hooks/useProfile.js';
import { PLATFORM_KEYS, PLATFORMS } from '../utils/platform.js';

const PLATFORM_CARDS = {
  codeforces: CodeforcesCard,
  leetcode: LeetCodeCard,
  codechef: CodeChefCard,
};

/** Panel heading used across the dashboard. */
const PanelTitle = ({ title, note }) => (
  <div className="mb-4">
    <h2 className="text-base font-semibold text-content-primary">{title}</h2>
    {note ? <p className="mt-0.5 text-sm text-content-muted">{note}</p> : null}
  </div>
);

const TopicLine = ({ topic, color }) => (
  <div>
    <ProgressBar
      label={topic.name}
      value={topic.percent}
      max={100}
      color={color}
      size="sm"
      showValue={false}
    />
    <p className="mt-1 font-mono text-[11px] text-content-muted">
      {topic.solved} solved
      {topic.averageRating ? ` · avg ${topic.averageRating}` : ''} · score {topic.percent}
    </p>
  </div>
);

export const ProfilePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const queryHandles = useMemo(
    () =>
      Object.fromEntries(
        PLATFORM_KEYS.map((key) => [key, searchParams.get(key) ?? '']).filter(
          ([, value]) => value !== '',
        ),
      ),
    [searchParams],
  );

  const hasQueryHandles = Object.keys(queryHandles).length > 0;

  // Signed-in users fall back to their linked handles (server side).
  const profileQuery = useProfileQuery(queryHandles, {
    enabled: hasQueryHandles || isAuthenticated,
  });

  const { refresh, isRefreshing, cooldownSeconds, canRefresh } = useProfileRefresh();

  const dashboard = profileQuery.data;
  const combined = dashboard?.combined;
  const activePlatforms = useMemo(
    () => PLATFORM_KEYS.filter((key) => dashboard?.platforms?.[key]),
    [dashboard],
  );

  // Guests carry their usernames in the URL, so Practice next gets them too.
  const practiceHref =
    isAuthenticated || !hasQueryHandles ? '/practice' : `/practice?${searchParams.toString()}`;

  const applyHandles = (handles) => {
    const params = Object.fromEntries(
      Object.entries(handles)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value !== ''),
    );
    setSearchParams(params);
  };

  /* --------------------------------------------------------- guest entry */
  if (!hasQueryHandles && !isAuthenticated) {
    return (
      <PageTransition>
        <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="My dashboard"
            description="Ratings, solved counts, activity and topic strengths from Codeforces, LeetCode and CodeChef. Type any usernames you have; leave the rest empty."
          />
          <HandleLookupForm onSubmit={applyHandles} isLoading={profileQuery.isFetching} />
        </section>
      </PageTransition>
    );
  }

  /* ------------------------------------------------------------- states */
  if (profileQuery.isLoading) {
    return (
      <PageTransition>
        <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
          <SkeletonCard className="h-32" />
          <SkeletonGrid count={3} />
          <SkeletonCard className="h-64" />
        </section>
      </PageTransition>
    );
  }

  if (profileQuery.error) {
    const noHandles = profileQuery.error.code === 'NO_HANDLES';

    return (
      <PageTransition>
        <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="My dashboard"
            description="Ratings, activity and topic strengths from all your platforms."
          />

          {noHandles ? (
            <EmptyState
              icon={Layers}
              title="Add your platform usernames first"
              description="The dashboard is built from your Codeforces, LeetCode and CodeChef usernames. Save them in Settings, or type them below for a quick look."
              action={
                <Button as={Link} to="/settings#usernames" size="sm">
                  Add usernames in Settings
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Could not build your dashboard"
              error={profileQuery.error}
              onRetry={profileQuery.refetch}
            />
          )}

          <div className="mt-8">
            <HandleLookupForm
              initialHandles={queryHandles}
              onSubmit={applyHandles}
              isLoading={profileQuery.isFetching}
            />
          </div>
        </section>
      </PageTransition>
    );
  }

  const weakest = combined?.weakest ?? [];
  const strongest = combined?.strongest ?? [];
  const neverAttempted = combined?.neverAttempted ?? [];

  const stats = [
    {
      label: 'Problems solved',
      value: combined?.totalSolved ?? 0,
      hint: PLATFORM_KEYS.filter((key) => combined?.solvedByPlatform?.[key])
        .map((key) => `${PLATFORMS[key].short} ${combined.solvedByPlatform[key]}`)
        .join(' · '),
    },
    { label: 'Rated contests', value: combined?.contests ?? 0, hint: 'across all platforms' },
    {
      label: 'Current streak',
      value: combined?.streaks?.current ?? 0,
      hint: `longest ${combined?.streaks?.longest ?? 0} days`,
    },
    {
      label: 'Working level',
      value: combined?.level?.rating ?? 0,
      hint: `from ${(combined?.level?.basis ?? '').replace(/-/g, ' ')}`,
    },
  ];

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="My dashboard"
          description="Where you stand across your platforms, and what to work on next."
          actions={
            isAuthenticated ? (
              <>
                <Tooltip
                  content={
                    canRefresh
                      ? 'Fetch the latest data from every platform'
                      : `Please wait ${cooldownSeconds}s before refreshing again`
                  }
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => refresh()}
                    disabled={!canRefresh}
                    loading={isRefreshing}
                  >
                    {canRefresh ? 'Refresh' : `Wait ${cooldownSeconds}s`}
                  </Button>
                </Tooltip>
                <Button as={Link} to="/settings#usernames" variant="ghost" size="sm">
                  Edit usernames
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
                  Look up someone else
                </Button>
                <Button as={Link} to="/register" variant="secondary" size="sm">
                  Save this dashboard
                </Button>
              </>
            )
          }
        >
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {activePlatforms.map((key) => (
              <a
                key={key}
                href={PLATFORMS[key].profileUrl(dashboard.handles[key])}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded hover:underline"
              >
                <span className="text-content-muted">{PLATFORMS[key].label}</span>{' '}
                <span className="font-mono text-content-primary">{dashboard.handles[key]}</span>
              </a>
            ))}
          </p>
          {combined?.anyStale ? <StaleBadge fetchedAt={profileQuery.dataUpdatedAt} /> : null}
        </PageHeader>

        {/* ------------------------------------------ degraded-source notice */}
        {combined?.anyFailed ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-state-warning/40 bg-state-warning/5 p-4">
            <CircleAlert size={18} className="mt-0.5 shrink-0 text-state-warning" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-content-primary">Some platforms did not respond</p>
              <p className="mt-1 text-content-secondary">
                {Object.entries(dashboard.statuses)
                  .filter(([, status]) => !status.ok)
                  .map(([platform, status]) => `${PLATFORMS[platform].label}: ${status.error}`)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-xs text-content-muted">The rest of this page is unaffected.</p>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------ what to work on + comparison */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass p-5">
            <PanelTitle
              title="What to work on"
              note="Your weakest topics that you have actually practised (3+ solves)."
            />

            {strongest.length === 0 ? (
              <p className="text-sm text-content-muted">
                Not enough solves yet. This fills in as you solve problems.
              </p>
            ) : (
              <>
                {weakest.length === 0 ? (
                  <p className="text-sm text-content-muted">
                    No weak topics yet: a topic needs 3 solved problems before it can count.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {weakest.map((topic) => (
                      <TopicLine key={topic.topicKey} topic={topic} color="warning" />
                    ))}
                  </div>
                )}

                <Button as={Link} to={practiceHref} size="sm" className="mt-5" iconRight={ArrowRight}>
                  Practise these topics
                </Button>

                {neverAttempted.length > 0 ? (
                  <div className="mt-6 border-t border-edge pt-4">
                    <p className="text-sm font-medium text-content-primary">Never tried</p>
                    <p className="mt-0.5 text-xs text-content-muted">
                      Kept separate: a topic you have not started is new, not weak.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {neverAttempted.map((topic) => (
                        <span key={topic.topicKey} className="chip">
                          {topic.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="glass p-5">
            <PanelTitle
              title="Topics by platform"
              note="Topics mean the same thing on every platform, so the shapes compare directly."
            />
            <TopicRadar data={combined?.radar ?? []} activePlatforms={activePlatforms} height={300} />

            {strongest.length > 0 ? (
              <div className="mt-4 border-t border-edge pt-4">
                <p className="mb-3 text-sm font-medium text-content-primary">Strongest</p>
                <div className="space-y-3">
                  {strongest.map((topic) => (
                    <TopicLine key={topic.topicKey} topic={topic} color="success" />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        {/* ----------------------------------------------------- numbers */}
        <dl className="glass mt-4 grid grid-cols-2 divide-edge lg:grid-cols-4 lg:divide-x">
          {stats.map((stat) => (
            <div key={stat.label} className="px-5 py-4">
              <dt className="text-sm text-content-muted">{stat.label}</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold text-content-primary tabular">
                <AnimatedNumber value={stat.value} />
              </dd>
              {stat.hint ? (
                <dd className="mt-0.5 truncate font-mono text-[11px] text-content-muted">{stat.hint}</dd>
              ) : null}
            </div>
          ))}
        </dl>

        {/* ---------------------------------------------------- heatmap */}
        <section className="glass mt-4 p-5">
          <ActivityHeatmap heatmap={combined?.heatmap ?? {}} title="Activity" />
          <p className="mt-2 text-xs text-content-muted">
            Codeforces submissions and the LeetCode calendar, merged by day (UTC). CodeChef does not
            publish daily activity.
          </p>
        </section>

        {/* ------------------------------------------------ platform cards */}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {PLATFORM_KEYS.filter((key) => dashboard.handles[key] || dashboard.statuses[key]).map(
            (key) => {
              const CardComponent = PLATFORM_CARDS[key];

              return (
                <div key={key} className={key === 'codechef' ? 'xl:col-span-2' : undefined}>
                  <CardComponent
                    data={dashboard.platforms[key]}
                    handle={dashboard.handles[key]}
                    status={dashboard.statuses[key]}
                    onRetry={profileQuery.refetch}
                  />
                </div>
              );
            },
          )}
        </div>

        {!isAuthenticated ? (
          <p className="mt-8 border-t border-edge pt-5 text-sm text-content-secondary">
            This view isn&apos;t saved.{' '}
            <Link to="/register" className="text-link">
              Create an account
            </Link>{' '}
            to keep your usernames, save problems and get contest reminders.
          </p>
        ) : null}
      </section>
    </PageTransition>
  );
};

export default ProfilePage;
