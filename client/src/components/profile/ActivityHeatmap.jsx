import { useMemo, useState } from 'react';

import cn from '../../utils/cn.js';

/**
 * Combined submission heatmap across platforms.
 *
 * Built as a plain CSS grid rather than a chart library: it is a calendar, and
 * a grid keeps it accessible (each cell carries a title + aria-label) and cheap
 * to render for 53 weeks of data.
 */

const WEEKS = 53;
const DAY_MS = 86_400_000;

const dayKey = (date) => date.toISOString().slice(0, 10);

const intensityClass = (count, max) => {
  if (!count) return 'bg-surface-inset';

  // Opacity steps of one blue read correctly on both dark and light surfaces.
  const ratio = count / Math.max(1, max);
  if (ratio > 0.75) return 'bg-brand-500';
  if (ratio > 0.5) return 'bg-brand-500/70';
  if (ratio > 0.25) return 'bg-brand-500/45';
  return 'bg-brand-500/25';
};

const LEGEND_TONES = [
  'bg-surface-inset',
  'bg-brand-500/25',
  'bg-brand-500/45',
  'bg-brand-500/70',
  'bg-brand-500',
];

export const ActivityHeatmap = ({ heatmap = {}, className, title = 'Activity' }) => {
  const [hovered, setHovered] = useState(null);

  const { columns, max, total, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Start on the Sunday that makes the grid end with today's week.
    const start = new Date(today.getTime() - (WEEKS * 7 - 1) * DAY_MS);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const grid = [];
    const labels = [];
    let highest = 0;
    let sum = 0;

    for (let week = 0; week < WEEKS; week += 1) {
      const column = [];

      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start.getTime() + (week * 7 + day) * DAY_MS);

        if (date > today) {
          column.push(null);
          continue;
        }

        const key = dayKey(date);
        const count = Number(heatmap[key] ?? 0);

        highest = Math.max(highest, count);
        sum += count;
        column.push({ key, date, count });
      }

      // Label a column when its first visible day starts a new month.
      const firstReal = column.find(Boolean);
      if (firstReal && firstReal.date.getUTCDate() <= 7) {
        labels.push({
          week,
          label: firstReal.date.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }),
        });
      }

      grid.push(column);
    }

    return { columns: grid, max: highest, total: sum, monthLabels: labels };
  }, [heatmap]);

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-content-primary">{title}</h3>
          <p className="text-xs text-content-muted">
            {total.toLocaleString()} submissions in the last year
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-content-muted">
          Less
          {LEGEND_TONES.map((tone) => (
            <span key={tone} className={cn('h-2.5 w-2.5 rounded-sm', tone)} aria-hidden="true" />
          ))}
          More
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        {/* w-max: month labels are placed as a % of this box, so it must be exactly as wide as the grid. */}
        <div className="w-max">
          <div className="relative mb-1 h-3">
            {monthLabels.map((entry) => (
              <span
                key={`${entry.week}-${entry.label}`}
                className="absolute text-[10px] text-content-muted"
                style={{ left: `${(entry.week / WEEKS) * 100}%` }}
              >
                {entry.label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]" role="img" aria-label={`${title}: ${total} submissions in the last year`}>
            {columns.map((column, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {column.map((cell, dayIndex) =>
                  cell ? (
                    <span
                      key={cell.key}
                      title={`${cell.count} submission${cell.count === 1 ? '' : 's'} on ${cell.key}`}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        'h-[11px] w-[11px] rounded-[3px] transition',
                        intensityClass(cell.count, max),
                        hovered?.key === cell.key && 'ring-1 ring-content-primary',
                      )}
                    />
                  ) : (
                    <span key={`${weekIndex}-${dayIndex}`} className="h-[11px] w-[11px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 h-4 text-xs text-content-secondary" aria-live="polite">
        {hovered
          ? `${hovered.count} submission${hovered.count === 1 ? '' : 's'} on ${hovered.key}`
          : ''}
      </p>
    </div>
  );
};

export default ActivityHeatmap;
