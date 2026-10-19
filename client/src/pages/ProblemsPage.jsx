import {
  Bookmark,
  Compass,
  Database,
  Filter,
  ListFilter,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { triggerProblemSync } from '../api/problems.api.js';
import { PageTransition, StaggerGroup, StaggerItem } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Pagination from '../components/common/Pagination.jsx';
import NoteDialog from '../components/problems/NoteDialog.jsx';
import ProblemFilters from '../components/problems/ProblemFilters.jsx';
import ProblemRow from '../components/problems/ProblemRow.jsx';
import TopicSidebar from '../components/problems/TopicSidebar.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState, StaleBadge } from '../components/ui/States.jsx';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import {
  useBookmarkMutations,
  useBookmarksQuery,
  useFacetsQuery,
  useProblemsQuery,
  useRawTagsQuery,
  useTopicProgressQuery,
} from '../hooks/useProblems.js';
import cn from '../utils/cn.js';
import { PLATFORMS } from '../utils/platform.js';

const ARRAY_KEYS = new Set(['topics', 'rawTags', 'divisions', 'difficulties']);
const NUMBER_KEYS = new Set(['ratingMin', 'ratingMax', 'minSolvedCount', 'page']);
const BOOLEAN_KEYS = new Set(['includeUnrated', 'excludePremium']);

const DEFAULTS = {
  platform: 'codeforces',
  tagMode: 'canonical',
  topics: [],
  rawTags: [],
  divisions: [],
  difficulties: [],
  search: '',
  status: 'all',
  sort: 'rating-asc',
  includeUnrated: true,
  excludePremium: false,
  page: 1,
  limit: 25,
};

/**
 * Allow-lists for values that come straight from the URL. Without these, a
 * hand-edited query string could put an unknown platform into PLATFORMS[...]
 * and crash the page instead of just showing no results.
 */
const ENUMS = {
  platform: ['codeforces', 'leetcode'],
  tagMode: ['canonical', 'raw'],
  status: ['all', 'solved', 'unsolved', 'attempted'],
  sort: ['rating-asc', 'rating-desc', 'popularity', 'newest', 'oldest', 'name'],
};

/** Filters live in the URL, so any view is shareable and survives a refresh. */
const readFilters = (searchParams) => {
  const filters = { ...DEFAULTS };

  for (const [key, rawValue] of searchParams.entries()) {
    if (!(key in DEFAULTS)) continue;
    if (ENUMS[key] && !ENUMS[key].includes(rawValue)) continue;

    if (ARRAY_KEYS.has(key)) {
      filters[key] = rawValue
        .split(',')
        .map((value) => (key === 'divisions' ? Number(value) : value))
        .filter((value) => value !== '' && !Number.isNaN(value));
    } else if (NUMBER_KEYS.has(key)) {
      filters[key] = Number(rawValue);
    } else if (BOOLEAN_KEYS.has(key)) {
      filters[key] = rawValue === 'true';
    } else {
      filters[key] = rawValue;
    }
  }

  return filters;
};

const toSearchParams = (filters) => {
  const params = {};

  for (const [key, value] of Object.entries(filters)) {
    const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULTS[key]);
    if (isDefault || value === undefined || value === null || value === '') continue;

    params[key] = Array.isArray(value) ? value.join(',') : String(value);
  }

  return params;
};

export const ProblemsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const debouncedSearch = useDebouncedValue(filters.search, 400);

  const [view, setView] = useState('browse');
  const [noteTarget, setNoteTarget] = useState(null);
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateFilters = useCallback(
    (patch, { resetPage = true } = {}) => {
      setSearchParams(
        (current) => {
          const next = { ...readFilters(current), ...patch };
          if (resetPage) next.page = 1;
          return toSearchParams(next);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = () =>
    setSearchParams(toSearchParams({ ...DEFAULTS, platform: filters.platform }), { replace: true });

  // The query sends the debounced search term, not every keystroke.
  const queryParams = useMemo(
    () => ({
      platform: filters.platform,
      topics: filters.topics,
      rawTags: filters.rawTags,
      divisions: filters.divisions,
      difficulties: filters.difficulties,
      ratingMin: filters.ratingMin,
      ratingMax: filters.ratingMax,
      includeUnrated: filters.includeUnrated,
      excludePremium: filters.excludePremium,
      minSolvedCount: filters.minSolvedCount,
      search: debouncedSearch,
      status: filters.status,
      sort: filters.sort,
      page: filters.page,
      limit: filters.limit,
    }),
    [filters, debouncedSearch],
  );

  const problemsQuery = useProblemsQuery(queryParams, { enabled: view === 'browse' });
  const facetsQuery = useFacetsQuery(filters.platform);
  const rawTagsQuery = useRawTagsQuery(filters.platform, { enabled: filters.tagMode === 'raw' });
  const bookmarksQuery = useBookmarksQuery(
    { page: 1, limit: 50 },
    { enabled: view === 'saved' && isAuthenticated },
  );

  const statusMeta = problemsQuery.data?.status ?? null;
  const hasHandle = Boolean(statusMeta?.handle && !statusMeta?.unavailable);

  const progressQuery = useTopicProgressQuery({
    platform: filters.platform,
    enabled: hasHandle && filters.tagMode === 'canonical',
  });

  const { toggleBookmark, setNote, setDone } = useBookmarkMutations();

  const topicLookup = useMemo(() => {
    const entries = facetsQuery.data?.topics ?? [];
    return new Map(entries.map((topic) => [topic.key, topic]));
  }, [facetsQuery.data]);

  const progressByTopic = useMemo(() => {
    const entries = progressQuery.data?.topics ?? [];
    return new Map(entries.map((topic) => [topic.key, topic]));
  }, [progressQuery.data]);

  const runSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerProblemSync();
      const ok = result.results?.filter((row) => row.ok) ?? [];

      toast.success(
        ok.length > 0 ? 'Problem sync finished' : 'Sync finished with errors',
        ok.map((row) => `${row.platform}: +${row.upserted}`).join(' · ') || undefined,
      );

      await Promise.all([problemsQuery.refetch(), facetsQuery.refetch()]);
    } catch (error) {
      toast.error('Sync failed', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const activeFilterCount =
    filters.topics.length +
    filters.rawTags.length +
    filters.divisions.length +
    filters.difficulties.length +
    (filters.search ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.minSolvedCount ? 1 : 0);

  const items = view === 'browse' ? problemsQuery.data?.items : bookmarksQuery.data?.items;
  const isLoading = view === 'browse' ? problemsQuery.isLoading : bookmarksQuery.isLoading;
  const error = view === 'browse' ? problemsQuery.error : bookmarksQuery.error;

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Problems"
          description={
            hasHandle
              ? 'Codeforces and LeetCode problems by topic, rating and difficulty. Ones you have solved are ticked.'
              : 'Codeforces and LeetCode problems by topic, rating and difficulty. Add your Codeforces username in Settings to see which ones you have solved.'
          }
          actions={
            <>
              {statusMeta?.stale ? (
                <StaleBadge fetchedAt={statusMeta.fetchedAt} reason={statusMeta.staleReason} />
              ) : null}

              {hasHandle ? (
                <Badge variant="codeforces" size="md">
                  Codeforces: {statusMeta.handle}
                </Badge>
              ) : isAuthenticated ? (
                <Button as={Link} to="/settings" variant="secondary" size="sm">
                  Link a handle
                </Button>
              ) : null}
            </>
          }
        />

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={filters.platform}
              onValueChange={(platform) =>
                updateFilters({
                  platform,
                  // Platform-specific filters do not carry over.
                  topics: [],
                  rawTags: [],
                  divisions: [],
                  difficulties: [],
                  ratingMin: undefined,
                  ratingMax: undefined,
                })
              }
            >
              <TabsList ariaLabel="Platform">
                {['codeforces', 'leetcode'].map((platform) => (
                  <TabsTrigger key={platform} value={platform}>
                    {PLATFORMS[platform].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Tabs value={view} onValueChange={setView}>
              <TabsList ariaLabel="View">
                <TabsTrigger value="browse" icon={ListFilter}>
                  Browse
                </TabsTrigger>
                <TabsTrigger value="saved" icon={Bookmark}>
                  Saved
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="ghost"
              size="sm"
              icon={Filter}
              className="lg:hidden"
              onClick={() => setShowFiltersOnMobile((open) => !open)}
              aria-expanded={showFiltersOnMobile}
            >
              Topics {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
          <div className={cn(showFiltersOnMobile ? 'block' : 'hidden lg:block')}>
            <TopicSidebar
              tagMode={filters.tagMode}
              onTagModeChange={(tagMode) => updateFilters({ tagMode })}
              topics={facetsQuery.data?.topics ?? []}
              rawTags={rawTagsQuery.data?.tags ?? []}
              selectedTopics={filters.topics}
              selectedRawTags={filters.rawTags}
              onToggleTopic={(key) =>
                updateFilters({
                  topics: filters.topics.includes(key)
                    ? filters.topics.filter((topic) => topic !== key)
                    : [...filters.topics, key],
                })
              }
              onToggleRawTag={(tag) =>
                updateFilters({
                  rawTags: filters.rawTags.includes(tag)
                    ? filters.rawTags.filter((item) => item !== tag)
                    : [...filters.rawTags, tag],
                })
              }
              onClear={() => updateFilters({ topics: [], rawTags: [] })}
              progressByTopic={progressByTopic}
              showProgress={hasHandle}
              isLoading={facetsQuery.isLoading}
            />
          </div>

          <div className="min-w-0 space-y-5">
            {view === 'browse' ? (
              <ProblemFilters
                filters={filters}
                onChange={updateFilters}
                onReset={resetFilters}
                ratingBounds={facetsQuery.data?.rating ?? { min: 800, max: 3500 }}
                platform={filters.platform}
                canFilterByStatus={hasHandle}
                totalResults={problemsQuery.data?.pagination?.total}
              />
            ) : null}

            {filters.topics.length > 0 || filters.rawTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-content-muted">Active:</span>

                {filters.topics.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      updateFilters({ topics: filters.topics.filter((topic) => topic !== key) })
                    }
                    className="chip chip-active focus-ring"
                    aria-label={`Remove ${topicLookup.get(key)?.name ?? key} filter`}
                  >
                    {topicLookup.get(key)?.name ?? key}
                    <X size={11} aria-hidden="true" />
                  </button>
                ))}

                {filters.rawTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      updateFilters({ rawTags: filters.rawTags.filter((item) => item !== tag) })
                    }
                    className="chip chip-active focus-ring"
                    aria-label={`Remove ${tag} filter`}
                  >
                    {tag}
                    <X size={11} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <ErrorState
                title="Could not load problems"
                error={error}
                onRetry={view === 'browse' ? problemsQuery.refetch : bookmarksQuery.refetch}
              />
            ) : isLoading ? (
              <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading problems">
                {Array.from({ length: 8 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            ) : view === 'saved' && !isAuthenticated ? (
              <EmptyState
                icon={Bookmark}
                title="Sign in to keep a reading list"
                description="Bookmarks and notes are tied to your account so they follow you between devices."
                action={
                  <Button as={Link} to="/login" size="sm">
                    Sign in
                  </Button>
                }
              />
            ) : items?.length === 0 ? (
              view === 'saved' ? (
                <EmptyState
                  icon={Bookmark}
                  title="No saved problems yet"
                  description="Bookmark a problem from the Browse tab and it will show up here with your notes."
                  action={
                    <Button size="sm" onClick={() => setView('browse')}>
                      Browse problems
                    </Button>
                  }
                />
              ) : (facetsQuery.data?.total ?? 0) === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No problems synced yet"
                  description="The problem collection is empty. Run a sync to pull the Codeforces problemset and the LeetCode topic list."
                  action={
                    isAuthenticated ? (
                      <Button size="sm" icon={RefreshCw} loading={isSyncing} onClick={runSync}>
                        Sync problems now
                      </Button>
                    ) : (
                      <p className="text-xs text-content-muted">
                        Sign in to trigger a sync, or run{' '}
                        <code className="font-mono">npm run seed --workspace=server</code>
                      </p>
                    )
                  }
                />
              ) : (
                <EmptyState
                  icon={Compass}
                  title="No problems match these filters"
                  description="Try widening the rating range, removing a topic, or clearing the search box."
                  action={
                    <Button variant="secondary" size="sm" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  }
                />
              )
            ) : (
              <>
                <StaggerGroup className="space-y-3">
                  {items.map((problem) => (
                    <StaggerItem key={problem.id}>
                      <ProblemRow
                        problem={problem}
                        topicLookup={topicLookup}
                        tagMode={filters.tagMode}
                        showStatus={hasHandle}
                        onToggleBookmark={isAuthenticated ? toggleBookmark : undefined}
                        onOpenNote={isAuthenticated ? setNoteTarget : undefined}
                        onToggleDone={
                          isAuthenticated
                            ? (target) => setDone(target.id, !target.bookmark?.done)
                            : undefined
                        }
                      />
                    </StaggerItem>
                  ))}
                </StaggerGroup>

                {view === 'browse' ? (
                  <Pagination
                    pagination={problemsQuery.data?.pagination}
                    onPageChange={(page) => {
                      updateFilters({ page }, { resetPage: false });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="pt-2"
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      <NoteDialog
        problem={noteTarget}
        open={Boolean(noteTarget)}
        onOpenChange={(open) => !open && setNoteTarget(null)}
        onSave={setNote}
      />
    </PageTransition>
  );
};

export default ProblemsPage;
