import { endOfMonth, startOfMonth } from 'date-fns';
import {
  CalendarClock,
  CalendarDays,
  Clock,
  List,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { triggerContestSync } from '../api/contests.api.js';
import { PageTransition, Reveal, StaggerGroup, StaggerItem } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import ContestCalendar from '../components/contests/ContestCalendar.jsx';
import ContestCard from '../components/contests/ContestCard.jsx';
import ReminderDialog from '../components/contests/ReminderDialog.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Select } from '../components/ui/Input.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState, StaleBadge } from '../components/ui/States.jsx';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  useContestsQuery,
  useReminderMutations,
  useRemindersQuery,
} from '../hooks/useContests.js';
import cn from '../utils/cn.js';
import { localTimezone } from '../utils/format.js';
import { PLATFORMS, PLATFORM_KEYS } from '../utils/platform.js';

const DURATION_OPTIONS = [
  { value: '', label: 'Any length' },
  { value: '3', label: 'Under 3 hours' },
  { value: '6', label: 'Under 6 hours' },
  { value: '24', label: 'Under a day' },
];

export const ContestsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [view, setView] = useState('list');
  const [status, setStatus] = useState('upcoming');
  const [platforms, setPlatforms] = useState([]);
  const [maxDuration, setMaxDuration] = useState('');
  const [month, setMonth] = useState(() => new Date());
  const [reminderTarget, setReminderTarget] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // The calendar view fetches a whole month; the list view uses the status filter.
  const params = useMemo(
    () =>
      view === 'calendar'
        ? {
            status: 'all',
            platforms,
            from: startOfMonth(month),
            to: endOfMonth(month),
            limit: 500,
            ...(maxDuration ? { maxDurationHours: Number(maxDuration) } : {}),
          }
        : {
            status,
            platforms,
            ...(maxDuration ? { maxDurationHours: Number(maxDuration) } : {}),
          },
    [view, status, platforms, maxDuration, month],
  );

  const contestsQuery = useContestsQuery(params);
  const remindersQuery = useRemindersQuery({ enabled: isAuthenticated });
  const { createReminder, cancelReminder } = useReminderMutations();

  const remindersByContest = useMemo(() => {
    const map = new Map();

    for (const reminder of remindersQuery.data?.reminders ?? []) {
      if (!['scheduled', 'sent'].includes(reminder.status)) continue;
      if (!map.has(reminder.contestId)) map.set(reminder.contestId, []);
      map.get(reminder.contestId).push(reminder);
    }

    return map;
  }, [remindersQuery.data]);

  const togglePlatform = (key) =>
    setPlatforms((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const runSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerContestSync();
      const ok = (result.results ?? []).filter((row) => row.ok);
      toast.success(
        ok.length > 0 ? 'Contest sync finished' : 'Sync finished with warnings',
        (result.results ?? [])
          .map((row) => `${row.source}: ${row.ok ? `${row.fetched} fetched` : row.error}`)
          .join(' · '),
      );
      await contestsQuery.refetch();
    } catch (error) {
      toast.error('Sync failed', error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const items = contestsQuery.data?.items ?? [];

  // LeetCode and CodeChef come through clist.by; say plainly when that link is missing or broken.
  const clistNotice = !contestsQuery.data
    ? null
    : !contestsQuery.data.clistConfigured
      ? "LeetCode and CodeChef contests come from a contest-listing service (clist.by) that isn't set up on this server yet, so you'll only see whatever was saved earlier."
      : contestsQuery.data.sources?.clist?.status === 'down'
        ? "LeetCode and CodeChef contests come from clist.by, which isn't responding to this server right now (usually an API key problem), so you'll only see whatever was saved earlier."
        : null;

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Contest calendar"
          description={`Codeforces, LeetCode and CodeChef contests in one list, in your time zone (${localTimezone()}).`}
          actions={
            <>
              {contestsQuery.data?.stale ? (
                <StaleBadge fetchedAt={contestsQuery.data.fetchedAt} />
              ) : null}

              {isAuthenticated ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    loading={isSyncing}
                    onClick={runSync}
                  >
                    Refresh contests
                  </Button>
                  <Button as={Link} to="/reminders" variant="ghost" size="sm" icon={Clock}>
                    My reminders
                  </Button>
                </>
              ) : null}
            </>
          }
        />

        {clistNotice ? (
          <Reveal className="mb-5">
            <div className="rounded-xl border border-state-warning/30 bg-state-warning/5 p-3 text-xs leading-relaxed text-content-secondary">
              <span className="font-medium text-content-primary">Only Codeforces is live right now. </span>
              {clistNotice}
            </div>
          </Reveal>
        ) : null}

        {/* ------------------------------------------------------- controls */}
        <Reveal>
          <Card className="mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <Tabs value={view} onValueChange={setView}>
                <TabsList ariaLabel="Calendar view">
                  <TabsTrigger value="list" icon={List}>
                    List
                  </TabsTrigger>
                  <TabsTrigger value="calendar" icon={CalendarDays}>
                    Month
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {view === 'list' ? (
                <Select
                  label="Show"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  containerClassName="w-40"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="running">Running now</option>
                  <option value="past">Finished</option>
                  <option value="all">Everything</option>
                </Select>
              ) : null}

              <Select
                label="Duration"
                value={maxDuration}
                onChange={(event) => setMaxDuration(event.target.value)}
                containerClassName="w-44"
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <div>
                <p className="mb-1.5 text-sm font-medium text-content-secondary">Platforms</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORM_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlatform(key)}
                      aria-pressed={platforms.includes(key)}
                      className={cn('chip focus-ring', platforms.includes(key) && 'chip-active')}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PLATFORMS[key].accent }}
                        aria-hidden="true"
                      />
                      {PLATFORMS[key].label}
                    </button>
                  ))}
                </div>
              </div>

              {contestsQuery.data ? (
                <Badge variant="brand" size="md" className="ml-auto">
                  {items.length} contest{items.length === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>
          </Card>
        </Reveal>

        {/* ---------------------------------------------------------- body */}
        {contestsQuery.error ? (
          <ErrorState
            title="Could not load contests"
            error={contestsQuery.error}
            onRetry={contestsQuery.refetch}
          />
        ) : contestsQuery.isLoading ? (
          <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading contests">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : view === 'calendar' ? (
          <ContestCalendar
            contests={items}
            month={month}
            onMonthChange={setMonth}
            onSelectContest={(contest) => setReminderTarget(contest)}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={
              status === 'running' ? 'No contest is running right now' : 'No contests to show'
            }
            description={
              platforms.length > 0 || maxDuration
                ? 'Try clearing the platform or duration filters.'
                : 'The cache may still be filling up. Signed-in users can trigger a sync from the header.'
            }
            action={
              platforms.length > 0 || maxDuration ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPlatforms([]);
                    setMaxDuration('');
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        ) : (
          <StaggerGroup className="glass divide-y divide-edge">
            {items.map((contest) => (
              <StaggerItem key={contest.id}>
                <ContestCard
                  contest={contest}
                  reminderCount={remindersByContest.get(contest.id)?.length ?? 0}
                  canRemind={isAuthenticated}
                  onRemind={(target) =>
                    isAuthenticated
                      ? setReminderTarget(target)
                      : toast.info('Sign in to set reminders', 'Calendar links work without an account.')
                  }
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}

        {items.length > 0 ? (
          <p className="mt-5 flex items-center gap-1.5 text-xs text-content-muted">
            <Timer size={12} aria-hidden="true" />
            Countdowns update every second in your local timezone.
          </p>
        ) : null}
      </section>

      <ReminderDialog
        contest={reminderTarget}
        open={Boolean(reminderTarget)}
        onOpenChange={(open) => !open && setReminderTarget(null)}
        existingReminders={remindersByContest.get(reminderTarget?.id) ?? []}
        onCreate={createReminder}
        onCancel={cancelReminder}
        deliveryChannel={remindersQuery.data?.delivery?.channel}
        userEmail={user?.email}
      />
    </PageTransition>
  );
};

export default ContestsPage;
