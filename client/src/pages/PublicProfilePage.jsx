import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Check, EyeOff, Flame, Sparkles, Trophy } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchPublicProfile } from '../api/public.api.js';
import { PageTransition, Reveal } from '../components/common/Motion.jsx';
import { SAMPLE_PUBLIC_PROFILE } from '../components/landing/sampleProfile.js';
import ActivityHeatmap from '../components/profile/ActivityHeatmap.jsx';
import ProfileCard from '../components/share/ProfileCard.jsx';
import ShareActions from '../components/share/ShareActions.jsx';
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { ProgressBar } from '../components/ui/Progress.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { formatNumber } from '../utils/format.js';
import { PLATFORMS } from '../utils/platform.js';

/** Mirrors the server's cardDescription() so previews and page text agree. */
const summarise = (card) => {
  if (!card) return '';

  const parts = [`${formatNumber(card.totalSolved)} problems solved`];
  if (card.ratings?.codeforces) parts.push(`Codeforces ${card.ratings.codeforces}`);
  if (card.ratings?.leetcode) parts.push(`LeetCode ${card.ratings.leetcode}`);
  if (card.ratings?.codechef) parts.push(`CodeChef ${card.ratings.codechef}`);

  return parts.join(' · ');
};

/**
 * `example` renders the landing page's sample profile (/example) through the
 * same layout, without fetching and without share actions.
 */
export const PublicProfilePage = ({ example = false }) => {
  const { username } = useParams();
  const cardRef = useRef(null);
  const query = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => fetchPublicProfile(username),
    retry: false,
    staleTime: 2 * 60_000,
    enabled: !example,
  });
  const data = example ? SAMPLE_PUBLIC_PROFILE : query.data;
  const isLoading = !example && query.isLoading;
  const error = example ? null : query.error;
  const { refetch } = query;
  const cardPath = example ? '/example/card' : `/u/${data?.owner?.username ?? username}/card`;

  const card = useMemo(() => {
    if (!data) return null;

    return {
      username: data.owner.username,
      displayName: data.owner.displayName,
      handles: data.handles ?? {},
      ratings: {
        codeforces: data.combined?.ratings?.codeforces ?? null,
        leetcode: data.combined?.ratings?.leetcode ?? null,
        codechef: data.combined?.ratings?.codechef ?? null,
        codechefStars: data.combined?.ratings?.codechefStars ?? null,
      },
      totalSolved: data.combined?.totalSolved ?? 0,
      contests: data.combined?.contests ?? 0,
      streak: data.combined?.streaks?.current ?? 0,
      topTopics: data.combined?.topTopics ?? [],
      heatmap: data.combined?.heatmap ?? {},
    };
  }, [data]);

  /* ---------------------------------------------------------- states */
  if (isLoading) {
    return (
      <PageTransition>
        <section className="mx-auto w-full max-w-5xl space-y-5 px-4 py-12 sm:px-6">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-40" />
        </section>
      </PageTransition>
    );
  }

  if (error) {
    const isPrivate = error.code === 'PROFILE_NOT_PUBLIC' || error.status === 404;

    return (
      <PageTransition>
        <section className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
          <h1 className="sr-only">{isPrivate ? 'Profile unavailable' : 'Profile could not load'}</h1>
          {isPrivate ? (
            <EmptyState
              icon={EyeOff}
              title="This profile is private"
              description={`Either @${username} does not exist, or they have not turned on public sharing. CodeHub keeps profiles private by default.`}
              action={
                <Button as={Link} to="/" size="sm">
                  Back to CodeHub
                </Button>
              }
            />
          ) : (
            <ErrorState title="Could not load this profile" error={error} onRetry={refetch} />
          )}
        </section>
      </PageTransition>
    );
  }

  const summary = summarise(card);
  const activePlatforms = Object.keys(data.handles ?? {});

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-inset text-xl font-semibold text-content-primary"
              aria-hidden="true"
            >
              {(data.owner.displayName || data.owner.username).slice(0, 1).toUpperCase()}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold text-content-primary sm:text-3xl">
                  {data.owner.displayName}
                </h1>
                <Badge variant="brand" size="sm">
                  {example ? 'Example' : 'Public profile'}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-sm text-content-muted">@{data.owner.username}</p>
              {data.owner.bio ? (
                <p className="mt-2 max-w-xl text-sm text-content-secondary">{data.owner.bio}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button as={Link} to={cardPath} variant="secondary" size="sm" iconRight={ArrowUpRight}>
              View card
            </Button>
            {example ? null : (
              <ShareActions
                username={data.owner.username}
                cardRef={cardRef}
                displayName={data.owner.displayName}
                summary={summary}
              />
            )}
          </div>
        </header>
        {example ? (
          <p className="-mt-2 mb-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-edge bg-surface-raised px-4 py-1.5 text-xs text-content-secondary shadow-card">
            <Sparkles size={13} className="text-brand-300" aria-hidden="true" />
            Example profile with made-up numbers.
            <Link to="/register" className="text-link">
              Make yours
            </Link>
          </p>
        ) : null}

        {data.empty ? (
          <EmptyState
            title="No platform handles yet"
            description={`@${data.owner.username} has made their profile public but has not linked any handles.`}
          />
        ) : (
          <>
            {/* ------------------------------------------------ the card */}
            <Reveal>
              <Card className="overflow-hidden">
                <div className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
                  <div className="flex justify-center rounded-2xl bg-surface-inset/60 p-6 sm:p-8">
                    <ProfileCard
                      ref={cardRef}
                      displayName={data.owner.displayName}
                      username={data.owner.username}
                      totalSolved={data.combined?.totalSolved ?? 0}
                      activeDays={data.combined?.streaks?.activeDays ?? 0}
                      handles={data.handles ?? {}}
                      topics={data.combined?.topTopics ?? []}
                      className="shadow-lift"
                    />
                  </div>
                  <div className="max-w-md">
                    <p className="eyebrow">Share card</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-content-primary">
                      {example ? 'Your card could look like this' : 'One card for every platform'}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                      Solved count, active days, the platforms you are on and your strongest topics.
                      {example
                        ? ' Sign up, add your usernames and turn on sharing to get yours.'
                        : ' Download it as an image, or share the link on LinkedIn, X or WhatsApp.'}
                    </p>
                    <ul className="mt-5 space-y-2.5 text-sm text-content-secondary">
                      {[
                        `${formatNumber(data.combined?.totalSolved ?? 0)} problems solved`,
                        `${formatNumber(data.combined?.streaks?.activeDays ?? 0)} active days`,
                        `${activePlatforms.length} platform${activePlatforms.length === 1 ? '' : 's'} linked`,
                      ].map((point) => (
                        <li key={point} className="flex items-center gap-2.5">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-300">
                            <Check size={12} strokeWidth={3} aria-hidden="true" />
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button as={Link} to={cardPath} variant="secondary" size="sm" iconRight={ArrowUpRight}>
                        Open card page
                      </Button>
                      {example ? (
                        <Button as={Link} to="/register" size="sm" iconRight={ArrowRight}>
                          Make yours
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            </Reveal>
            {/* ----------------------------------------------- summary */}
            <Reveal className="mt-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: 'Total solved',
                    value: data.combined?.totalSolved ?? 0,
                    icon: Trophy,
                    hint: activePlatforms
                      .map(
                        (key) =>
                          `${PLATFORMS[key].short} ${formatNumber(
                            data.combined?.solvedByPlatform?.[key] ?? 0,
                          )}`,
                      )
                      .join(' · '),
                  },
                  {
                    label: 'Contests',
                    value: data.combined?.contests ?? 0,
                    icon: Trophy,
                    hint: 'Rated contests entered',
                  },
                  {
                    label: 'Current streak',
                    value: data.combined?.streaks?.current ?? 0,
                    icon: Flame,
                    hint: `Longest ${data.combined?.streaks?.longest ?? 0} days`,
                  },
                ].map((tile) => (
                  <Card key={tile.label} hover className="p-4">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-medium text-content-secondary">{tile.label}</p>
                      <tile.icon size={15} className="text-brand-300" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-display text-2xl font-bold text-content-primary">
                      <AnimatedNumber value={tile.value} />
                    </p>
                    <p className="mt-1 truncate text-[11px] text-content-muted">{tile.hint}</p>
                  </Card>
                ))}
              </div>
            </Reveal>

            {/* ------------------------------------------------ topics */}
            {data.combined?.topTopics?.length > 0 ? (
              <Reveal className="mt-6">
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Top topics</CardTitle>
                      <CardDescription>
                        Topics with the most solved problems, counted across all platforms.
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <div className="space-y-3">
                    {data.combined.topTopics.map((topic) => (
                      <div key={topic.topicKey}>
                        <ProgressBar
                          label={topic.name}
                          value={topic.solved}
                          max={data.combined.topTopics[0].solved}
                          color="brand"
                          size="sm"
                          showValue={false}
                        />
                        <p className="mt-0.5 text-[11px] text-content-muted">
                          {topic.solved} solved · strength score {topic.score}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            ) : null}

            <Reveal className="mt-6">
              <Card>
                <ActivityHeatmap heatmap={data.combined?.heatmap ?? {}} title="Activity" />
              </Card>
            </Reveal>
          </>
        )}

        <Reveal className="mt-8">
          <Card className="text-center">
            <p className="font-display text-base font-semibold text-content-primary">
              Want a dashboard like this?
            </p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-content-secondary">
              CodeHub unifies LeetCode, Codeforces and CodeChef: topic-wise browsing, weak-topic
              practice and one contest calendar.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button as={Link} to="/register" size="sm" iconRight={ArrowRight}>
                Create your profile
              </Button>
              <Button as={Link} to="/problems" variant="secondary" size="sm">
                Browse problems
              </Button>
            </div>
          </Card>
        </Reveal>
      </section>
    </PageTransition>
  );
};

export default PublicProfilePage;
