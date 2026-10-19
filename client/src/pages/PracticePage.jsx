import { Compass, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageTransition } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import QuickStartForm from '../components/practice/QuickStartForm.jsx';
import RecommendationRow from '../components/practice/RecommendationRow.jsx';
import Button from '../components/ui/Button.jsx';
import { Select } from '../components/ui/Input.jsx';
import { ProgressBar } from '../components/ui/Progress.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBookmarkMutations, useBookmarksQuery } from '../hooks/useProblems.js';
import { useRecommendationsQuery } from '../hooks/useRecommendations.js';
import cn from '../utils/cn.js';
import { PLATFORM_KEYS, PLATFORMS } from '../utils/platform.js';

const COUNT_OPTIONS = [6, 12, 18, 24];

const OFFSET_OPTIONS = [
  { value: '', label: '+100 to +200 (default)' },
  { value: '0', label: 'At my level (+0 to +100)' },
  { value: '200', label: 'Stretch (+200 to +300)' },
  { value: '400', label: 'Hard push (+400 to +500)' },
];

const toggleIn = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/** Small labelled section in the right-hand column. */
const SideSection = ({ title, note, children }) => (
  <section className="border-b border-edge pb-5 last:border-b-0">
    <h2 className="text-sm font-semibold text-content-primary">{title}</h2>
    {note ? <p className="mt-0.5 text-xs leading-relaxed text-content-muted">{note}</p> : null}
    <div className="mt-3">{children}</div>
  </section>
);

export const PracticePage = () => {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Guests can pass usernames in the URL (?codeforces=... or ?leetcode=...).
  const queryHandles = useMemo(
    () =>
      Object.fromEntries(
        PLATFORM_KEYS.map((key) => [key, searchParams.get(key) ?? '']).filter(
          ([, value]) => value !== '',
        ),
      ),
    [searchParams],
  );

  // Start on the platform the guest actually gave us a username for.
  const [platform, setPlatform] = useState(() =>
    !searchParams.get('codeforces') && searchParams.get('leetcode') ? 'leetcode' : 'codeforces',
  );
  const [count, setCount] = useState(12);
  const [offset, setOffset] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);

  const params = useMemo(
    () => ({
      platform,
      count,
      topics: selectedTopics,
      ...(offset !== '' ? { difficultyOffset: Number(offset) } : {}),
      ...queryHandles,
    }),
    [platform, count, offset, selectedTopics, queryHandles],
  );

  const hasHandles = isAuthenticated || Object.keys(queryHandles).length > 0;
  const { data, isLoading, isFetching, error, refetch, shuffle } = useRecommendationsQuery(params, {
    enabled: hasHandles,
  });

  const bookmarksQuery = useBookmarksQuery({ page: 1, limit: 100 }, { enabled: isAuthenticated });
  const { toggleBookmark, setDone } = useBookmarkMutations();

  const bookmarkState = useMemo(() => {
    const map = new Map();
    for (const row of bookmarksQuery.data?.items ?? []) {
      map.set(row.id, row.bookmark);
    }
    return map;
  }, [bookmarksQuery.data]);

  /* ------------------------------------------------ nobody to look up yet */
  if (!hasHandles) {
    return (
      <PageTransition>
        <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Practice next"
            description="Unsolved problems from your weakest topics, rated a little above your current level."
          />

          <div className="glass p-5 sm:p-6">
            <h2 className="text-base font-semibold text-content-primary">
              Whose history should we look at?
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              Type your Codeforces or LeetCode username. CodeHub reads your solved problems and
              picks the next ones.
            </p>
            <QuickStartForm className="mt-5" />
          </div>

          <p className="mt-4 text-sm text-content-muted">
            Want this to remember you?{' '}
            <Link to={isAuthenticated ? '/settings#usernames' : '/register'} className="text-link">
              {isAuthenticated ? 'Save your usernames in Settings' : 'Create an account'}
            </Link>
          </p>
        </section>
      </PageTransition>
    );
  }

  const weakTopics = data?.weakTopics ?? [];
  const isColdStart = data?.meta?.isColdStart;
  const lookedUp = queryHandles[platform] ?? queryHandles.codeforces ?? queryHandles.leetcode;

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Practice next"
          description="Unsolved problems from your weakest topics, rated a little above your level. Each one says why it was picked."
          actions={
            <Tooltip content="Same topics, different problems">
              <Button
                variant="secondary"
                size="sm"
                icon={Shuffle}
                onClick={shuffle}
                loading={isFetching && !isLoading}
              >
                Shuffle
              </Button>
            </Tooltip>
          }
        >
          {lookedUp && !isAuthenticated ? (
            <span className="text-sm text-content-secondary">
              Showing results for <span className="font-mono text-content-primary">{lookedUp}</span>
              {' · '}
              <Link to="/practice" className="text-link">
                change
              </Link>
            </span>
          ) : null}
        </PageHeader>

        {/* ------------------------------------------------------- controls */}
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Tabs value={platform} onValueChange={setPlatform}>
            <TabsList ariaLabel="Platform">
              {['codeforces', 'leetcode'].map((key) => (
                <TabsTrigger key={key} value={key}>
                  {PLATFORMS[key].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {platform === 'codeforces' ? (
            <Select
              label="Difficulty"
              value={offset}
              onChange={(event) => setOffset(event.target.value)}
              containerClassName="w-60"
            >
              {OFFSET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : null}

          <Select
            label="Show"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            containerClassName="w-24"
          >
            {COUNT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>

          {selectedTopics.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setSelectedTopics([])}>
              Back to my weak topics
            </Button>
          ) : null}
        </div>

        {data ? (
          <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-content-muted">
            <span>
              level <span className="text-content-primary">{data.level?.rating ?? '-'}</span>
            </span>
            {platform === 'codeforces' ? (
              <span>
                target{' '}
                <span className="text-content-primary">
                  {data.target?.ratingMin}–{data.target?.ratingMax}
                </span>
              </span>
            ) : (
              <span>
                difficulty{' '}
                <span className="text-content-primary">
                  {data.target?.leetcodeDifficulties?.join(' / ')}
                </span>
              </span>
            )}
            <span>
              skipped <span className="text-content-primary">{data.meta?.excludedSolved ?? 0}</span>{' '}
              already solved
            </span>
            {data.meta?.formula ? (
              <Tooltip content={data.meta.formula}>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  how topics are scored
                </span>
              </Tooltip>
            ) : null}
          </p>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {/* ---------------------------------------------------- the list */}
          <div className="min-w-0">
            {error ? (
              <ErrorState title="Could not pick problems" error={error} onRetry={refetch} />
            ) : isLoading ? (
              <div className="glass divide-y divide-edge" role="status" aria-label="Loading problems">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-2 px-4 py-4">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))}
              </div>
            ) : data?.items?.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="Nothing unsolved in that range"
                description="Either the problem list is still syncing, or you have solved everything there. Try another difficulty or platform."
                action={
                  <Button as={Link} to="/problems" variant="secondary" size="sm">
                    Browse all problems
                  </Button>
                }
              />
            ) : (
              <ol className="glass divide-y divide-edge">
                {data.items.map((item) => (
                  <RecommendationRow
                    key={item.id}
                    item={item}
                    isBookmarked={bookmarkState.get(item.id)?.bookmarked}
                    isDone={bookmarkState.get(item.id)?.done}
                    onToggleBookmark={
                      isAuthenticated
                        ? (target) =>
                            toggleBookmark({
                              id: target.id,
                              bookmark: bookmarkState.get(target.id) ?? null,
                            })
                        : undefined
                    }
                    onMarkDone={
                      isAuthenticated
                        ? (target) => setDone(target.id, !bookmarkState.get(target.id)?.done)
                        : undefined
                    }
                  />
                ))}
              </ol>
            )}

            {!isAuthenticated && data?.items?.length > 0 ? (
              <p className="mt-3 text-sm text-content-muted">
                <Link to="/register" className="text-link">
                  Create an account
                </Link>{' '}
                to save problems and tick them off as you solve them.
              </p>
            ) : null}
          </div>

          {/* ------------------------------------------- why these problems */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <SideSection
              title={isColdStart ? 'Starting points' : 'Your weakest topics'}
              note={
                isColdStart
                  ? 'No solve history yet, so these are the fundamentals.'
                  : `Topics with at least ${data?.meta?.minSolvedForActiveTopic ?? 3} solves, weakest first. Click one to practise only that.`
              }
            >
              {weakTopics.length === 0 ? (
                <p className="text-sm text-content-muted">Not enough data yet.</p>
              ) : (
                <ul className="space-y-1">
                  {weakTopics.map((topic) => {
                    const active = selectedTopics.includes(topic.topicKey);
                    return (
                      <li key={topic.topicKey}>
                        <button
                          type="button"
                          onClick={() => setSelectedTopics((current) => toggleIn(current, topic.topicKey))}
                          aria-pressed={active}
                          className={cn(
                            'focus-ring w-full rounded-md px-2 py-1.5 text-left transition-colors',
                            active ? 'bg-brand-500/10' : 'hover:bg-surface-inset',
                          )}
                        >
                          <ProgressBar
                            label={topic.name}
                            value={topic.score ?? 0}
                            max={100}
                            color="warning"
                            size="sm"
                            showValue={false}
                          />
                          <p className="mt-1 font-mono text-[11px] text-content-muted">
                            {topic.solved} solved
                            {topic.averageRating ? ` · avg ${topic.averageRating}` : ''} · score{' '}
                            {topic.score}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SideSection>

            {data?.exploreTopics?.length > 0 ? (
              <SideSection
                title="Never tried"
                note="Listed separately: a topic you have not started is new, not weak."
              >
                <div className="flex flex-wrap gap-1.5">
                  {data.exploreTopics.map((topic) => (
                    <button
                      key={topic.topicKey}
                      type="button"
                      onClick={() => setSelectedTopics((current) => toggleIn(current, topic.topicKey))}
                      aria-pressed={selectedTopics.includes(topic.topicKey)}
                      className={cn(
                        'chip focus-ring',
                        selectedTopics.includes(topic.topicKey) && 'chip-active',
                      )}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </SideSection>
            ) : null}

            {data?.meta?.notes?.length > 0 ? (
              <SideSection title="Partial data">
                <ul className="space-y-1 text-xs text-state-warning">
                  {data.meta.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </SideSection>
            ) : null}
          </aside>
        </div>
      </section>
    </PageTransition>
  );
};

export default PracticePage;
