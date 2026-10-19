import { useQuery } from '@tanstack/react-query';
import { ArrowRight, EyeOff, Flame, Trophy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchPublicProfile } from '../api/public.api.js';
import { PageTransition, Reveal } from '../components/common/Motion.jsx';
import ActivityHeatmap from '../components/profile/ActivityHeatmap.jsx';
import ProfileShareCard, { CARD_THEMES } from '../components/share/ProfileShareCard.jsx';
import ScaledCardPreview from '../components/share/ScaledCardPreview.jsx';
import ShareActions from '../components/share/ShareActions.jsx';
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { ProgressBar } from '../components/ui/Progress.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import cn from '../utils/cn.js';
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

export const PublicProfilePage = () => {
  const { username } = useParams();
  const cardRef = useRef(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => fetchPublicProfile(username),
    retry: false,
    staleTime: 2 * 60_000,
  });

  /**
   * The owner's saved theme is the default; a visitor's click overrides it for
   * their session only. Deriving this avoids syncing server data into state.
   */
  const [themeOverride, setThemeOverride] = useState(null);
  const theme = themeOverride ?? data?.owner?.cardTheme ?? 'dark-neon';

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
                  Public profile
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-sm text-content-muted">@{data.owner.username}</p>
              {data.owner.bio ? (
                <p className="mt-2 max-w-xl text-sm text-content-secondary">{data.owner.bio}</p>
              ) : null}
            </div>
          </div>

          <ShareActions
            username={data.owner.username}
            cardRef={cardRef}
            displayName={data.owner.displayName}
            summary={summary}
          />
        </header>

        {data.empty ? (
          <EmptyState
            title="No platform handles yet"
            description={`@${data.owner.username} has made their profile public but has not linked any handles.`}
          />
        ) : (
          <>
            {/* ------------------------------------------------ the card */}
            <Reveal>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>
                      Share card
                    </CardTitle>
                    <CardDescription>
                      Pick a style, then download the image or share the link on LinkedIn or X.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CARD_THEMES.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setThemeOverride(option.key)}
                        aria-pressed={theme === option.key}
                        className={cn('chip focus-ring', theme === option.key && 'chip-active')}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>

                {/* Scaled for display; the captured node stays a true 1200x630. */}
                <ScaledCardPreview className="rounded-xl border border-edge">
                  <ProfileShareCard ref={cardRef} card={card} theme={theme} />
                </ScaledCardPreview>

                <p className="mt-3 text-xs text-content-muted">
                  The preview scales to fit; the exported image is always 1200x630, the size
                  LinkedIn and X expect.
                </p>
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
