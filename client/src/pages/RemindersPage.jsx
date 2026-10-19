import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Mail,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageTransition, Reveal, StaggerGroup, StaggerItem } from '../components/common/Motion.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { useReminderMutations, useRemindersQuery } from '../hooks/useContests.js';
import { formatDateTime, localTimezone } from '../utils/format.js';
import { getPlatform } from '../utils/platform.js';

const OFFSET_LABEL = { '1d': '1 day before', '1h': '1 hour before', '15m': '15 min before' };

const STATUS_META = {
  scheduled: { label: 'Scheduled', variant: 'brand', icon: Clock },
  sent: { label: 'Sent', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'danger', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', variant: 'neutral', icon: XCircle },
  skipped: { label: 'Skipped', variant: 'warning', icon: AlertTriangle },
  claimed: { label: 'Sending', variant: 'brand', icon: Clock },
};

const ReminderRow = ({ reminder, onCancel, isCancelling }) => {
  const platform = getPlatform(reminder.contest.platform);
  const status = STATUS_META[reminder.status] ?? STATUS_META.scheduled;
  const countdown = useCountdown(reminder.dueAt);
  const canCancel = ['scheduled', 'failed'].includes(reminder.status);

  return (
    <article className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={platform.badge} size="xs">
            {platform.label}
          </Badge>
          <Badge variant={status.variant} size="xs" icon={status.icon}>
            {status.label}
          </Badge>
          <Badge variant="neutral" size="xs">
            {OFFSET_LABEL[reminder.offsetKey] ?? reminder.offsetKey}
          </Badge>
        </div>

        <h3 className="mt-2 truncate text-sm font-medium text-content-primary">
          <a
            href={reminder.contest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded hover:text-brand-200"
          >
            {reminder.contest.name}
          </a>
        </h3>

        <p className="mt-1 text-xs text-content-muted">
          Contest starts {formatDateTime(reminder.contest.startTime)}
          {reminder.sentAt ? ` · email sent ${formatDateTime(reminder.sentAt)}` : ''}
        </p>

        {reminder.lastError ? (
          <p className="mt-1 text-xs text-state-danger">Last error: {reminder.lastError}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {reminder.status === 'scheduled' ? (
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-content-primary">
              {countdown.hasPassed ? 'due now' : countdown.label}
            </p>
            <p className="text-[11px] text-content-muted">until reminder</p>
          </div>
        ) : null}

        {canCancel ? (
          <Tooltip content="Cancel this reminder">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCancel(reminder.id)}
              loading={isCancelling}
              aria-label={`Cancel reminder for ${reminder.contest.name}`}
            >
              <Trash2 size={15} className="text-state-danger" />
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </article>
  );
};

export const RemindersPage = () => {
  const [filter, setFilter] = useState('active');

  const { data, isLoading, error, refetch } = useRemindersQuery();
  const { cancelReminder, isCancelling } = useReminderMutations();

  // Memoised so the list below does not see a new array identity every render.
  const reminders = useMemo(() => data?.reminders ?? [], [data]);

  const filtered = useMemo(() => {
    if (filter === 'active') {
      return reminders.filter((reminder) => ['scheduled', 'claimed'].includes(reminder.status));
    }
    if (filter === 'history') {
      return reminders.filter((reminder) =>
        ['sent', 'failed', 'cancelled', 'skipped'].includes(reminder.status),
      );
    }
    return reminders;
  }, [reminders, filter]);

  const activeCount = reminders.filter((reminder) => reminder.status === 'scheduled').length;

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="My reminders"
          description={`Contest emails you have set up, and whether they went out. Add one with "Remind me" on the Contest calendar. Times in ${localTimezone()}.`}
          actions={
            <Button as={Link} to="/contests" variant="secondary" size="sm">
              Contest calendar
            </Button>
          }
        />

        {data?.delivery ? (
          <Reveal className="mb-6">
            <Card className="flex flex-wrap items-center justify-between gap-3 py-3">
              <p className="flex items-center gap-2 text-sm text-content-secondary">
                <Mail size={14} className="text-brand-300" aria-hidden="true" />
                Delivering to{' '}
                <span className="font-medium text-content-primary">{data.delivery.email}</span>
              </p>

              <div className="flex items-center gap-2">
                <Badge variant={activeCount > 0 ? 'brand' : 'neutral'} size="sm" icon={BellRing}>
                  {activeCount} scheduled
                </Badge>

                {data.delivery.channel === 'console-fallback' ? (
                  <Tooltip content="No SMTP credentials on the server, so reminder emails are written to the server log instead of being sent.">
                    <Badge variant="warning" size="sm">
                      Email not set up (log only)
                    </Badge>
                  </Tooltip>
                ) : (
                  <Badge variant="success" size="sm">
                    Email on
                  </Badge>
                )}

                {data.delivery.enabled === false ? (
                  <Tooltip content="Reminder emails are switched off in your settings">
                    <Badge variant="danger" size="sm">
                      Turned off in Settings
                    </Badge>
                  </Tooltip>
                ) : null}
              </div>
            </Card>
          </Reveal>
        ) : null}

        <Tabs value={filter} onValueChange={setFilter} className="mb-5">
          <TabsList ariaLabel="Reminder filter">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {error ? (
          <ErrorState title="Could not load reminders" error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading reminders">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={filter === 'history' ? 'Nothing here yet' : 'No reminders set'}
            description={
              filter === 'history'
                ? 'Sent, failed and cancelled reminders will appear here.'
                : 'Open the contest calendar and hit "Remind me" on anything you do not want to miss.'
            }
            action={
              <Button as={Link} to="/contests" size="sm" icon={CalendarClock}>
                Browse contests
              </Button>
            }
          />
        ) : (
          <StaggerGroup className="glass divide-y divide-edge">
            {filtered.map((reminder) => (
              <StaggerItem key={reminder.id}>
                <ReminderRow
                  reminder={reminder}
                  onCancel={cancelReminder}
                  isCancelling={isCancelling}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </section>
    </PageTransition>
  );
};

export default RemindersPage;
