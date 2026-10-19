import {
  BellRing,
  CalendarPlus,
  Download,
  ExternalLink,
  Radio,
  Timer,
} from 'lucide-react';

import { contestIcsUrl } from '../../api/contests.api.js';
import { useCountdown } from '../../hooks/useCountdown.js';
import cn from '../../utils/cn.js';
import { formatDateTime, formatDuration } from '../../utils/format.js';
import { getPlatform } from '../../utils/platform.js';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * One contest. Times come from the API in UTC and are rendered by the browser
 * in the viewer's own timezone; the countdown ticks locally every second.
 */
export const ContestCard = ({ contest, onRemind, reminderCount = 0, canRemind }) => {
  const platform = getPlatform(contest.platform);
  const countdown = useCountdown(contest.startTime);
  const isRunning = contest.phase === 'coding';
  const isFinished = contest.phase === 'finished';

  return (
    <article
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center',
        isFinished && 'opacity-70',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={platform.badge} size="xs">
            {platform.label}
          </Badge>

          {contest.division ? (
            <Badge variant="neutral" size="xs">
              Div. {contest.division}
            </Badge>
          ) : null}

          {isRunning ? (
            <Badge variant="success" icon={Radio} size="xs">
              Live now
            </Badge>
          ) : null}

          {reminderCount > 0 ? (
            <Tooltip content={`${reminderCount} reminder${reminderCount === 1 ? '' : 's'} set`}>
              <Badge variant="brand" icon={BellRing} size="xs">
                {reminderCount}
              </Badge>
            </Tooltip>
          ) : null}
        </div>

        <h3 className="mt-2">
          <a
            href={contest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring group inline-flex items-start gap-1.5 rounded font-display text-sm font-semibold text-content-primary hover:text-brand-200 sm:text-base"
          >
            <span className="min-w-0">{contest.name}</span>
            <ExternalLink
              size={12}
              className="mt-1 shrink-0 opacity-0 transition group-hover:opacity-100"
              aria-hidden="true"
            />
          </a>
        </h3>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
          <span>{formatDateTime(contest.startTime)}</span>
          <span className="inline-flex items-center gap-1">
            <Timer size={11} aria-hidden="true" />
            {formatDuration(contest.durationSeconds)}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <div className="text-left sm:text-right">
          <p
            className={cn(
              'font-mono text-base font-semibold',
              isRunning ? 'text-state-success' : 'text-content-primary',
            )}
          >
            {isFinished ? 'Ended' : isRunning ? 'Running' : countdown.label}
          </p>
          <p className="text-[11px] text-content-muted">
            {isFinished ? '' : isRunning ? 'in progress' : 'until start'}
          </p>
        </div>

        {!isFinished ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              as="a"
              href={contest.googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="xs"
              icon={CalendarPlus}
              aria-label={`Add ${contest.name} to Google Calendar`}
            >
              Add to calendar
            </Button>

            <Tooltip content="Download .ics file (Apple Calendar, Outlook)">
              <Button
                as="a"
                href={contestIcsUrl(contest.id)}
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Download calendar file for ${contest.name}`}
              >
                <Download size={14} />
              </Button>
            </Tooltip>

            <Button
              variant="secondary"
              size="xs"
              icon={BellRing}
              onClick={() => onRemind(contest)}
              title={canRemind ? undefined : 'Sign in to set reminders'}
              className={reminderCount > 0 ? 'border-brand-500/50 text-brand-300' : undefined}
            >
              {reminderCount > 0 ? 'Reminder set' : 'Remind me'}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default ContestCard;
