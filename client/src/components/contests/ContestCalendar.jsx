import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import cn from '../../utils/cn.js';
import { formatTime } from '../../utils/format.js';
import { getPlatform } from '../../utils/platform.js';
import Button from '../ui/Button.jsx';
import Tooltip from '../ui/Tooltip.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month grid, colour-coded by platform. Weeks start on Monday, which is what
 * competitive programmers expect from contest schedules.
 */
export const ContestCalendar = ({ contests = [], month, onMonthChange, onSelectContest }) => {
  const [internalMonth, setInternalMonth] = useState(() => month ?? new Date());
  const activeMonth = month ?? internalMonth;

  const changeMonth = (next) => {
    setInternalMonth(next);
    onMonthChange?.(next);
  };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(activeMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(activeMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [activeMonth]);

  const byDay = useMemo(() => {
    const map = new Map();

    for (const contest of contests) {
      const date = new Date(contest.startTime);
      const key = format(date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(contest);
    }

    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    }

    return map;
  }, [contests]);

  return (
    <div className="glass p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-content-primary">
          {format(activeMonth, 'MMMM yyyy')}
        </h2>

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => changeMonth(subMonths(activeMonth, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => changeMonth(new Date())}>
            Today
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => changeMonth(addMonths(activeMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Contest calendar">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="pb-1 text-center text-xs font-medium text-content-muted"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayContests = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, activeMonth);

          return (
            <div
              key={key}
              role="gridcell"
              aria-label={`${format(day, 'd MMMM yyyy')}: ${dayContests.length} contests`}
              className={cn(
                'min-h-[4.75rem] rounded-lg border p-1.5 transition',
                inMonth
                  ? 'border-edge/70 bg-surface-inset/40'
                  : 'border-transparent bg-transparent opacity-45',
                isToday(day) && 'border-brand-400/70 bg-brand-500/10',
              )}
            >
              <p
                className={cn(
                  'mb-1 text-[11px] font-medium',
                  isToday(day) ? 'text-brand-200' : 'text-content-muted',
                )}
              >
                {format(day, 'd')}
              </p>

              <div className="space-y-1">
                {dayContests.slice(0, 3).map((contest) => {
                  const platform = getPlatform(contest.platform);

                  return (
                    <Tooltip
                      key={contest.id}
                      content={`${contest.name} · ${formatTime(contest.startTime)}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectContest?.(contest)}
                        className="focus-ring block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight text-content-primary transition hover:brightness-125"
                        style={{ backgroundColor: `${platform.accent}28` }}
                      >
                        <span
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ backgroundColor: platform.accent }}
                          aria-hidden="true"
                        />
                        {formatTime(contest.startTime)} {contest.name}
                      </button>
                    </Tooltip>
                  );
                })}

                {dayContests.length > 3 ? (
                  <p className="px-1 text-[10px] text-content-muted">
                    +{dayContests.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge/70 pt-3">
        {['codeforces', 'leetcode', 'codechef'].map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-xs text-content-secondary">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getPlatform(key).accent }}
              aria-hidden="true"
            />
            {getPlatform(key).label}
          </span>
        ))}

        {isSameDay(activeMonth, activeMonth) ? null : null}
      </div>
    </div>
  );
};

export default ContestCalendar;
