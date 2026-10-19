import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDateTime } from '../../utils/format.js';
import { EmptyState } from '../ui/States.jsx';

/** Shared tooltip so both rating charts read identically. */
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="glass-strong max-w-xs p-3 text-xs">
      <p className="font-medium text-content-primary">{point.contestName || 'Contest'}</p>
      <p className="mt-1 font-mono text-content-secondary">
        Rating {point.newRating}
        {point.delta !== null && point.delta !== undefined ? (
          <span className={point.delta >= 0 ? 'text-state-success' : 'text-state-danger'}>
            {' '}
            ({point.delta >= 0 ? '+' : ''}
            {point.delta})
          </span>
        ) : null}
      </p>
      {point.rank ? <p className="text-content-muted">Rank {point.rank.toLocaleString()}</p> : null}
      {point.at ? <p className="mt-1 text-content-muted">{formatDateTime(point.at)}</p> : null}
    </div>
  );
};

export const RatingChart = ({ history = [], accent = '#2b9a5c', height = 220, label = 'Rating' }) => {
  if (history.length < 2) {
    return (
      <EmptyState
        title="Not enough contest history"
        description="Rating graphs need at least two rated contests on this platform."
        className="py-8"
      />
    );
  }

  const data = history.map((entry, index) => ({
    ...entry,
    index,
    delta:
      entry.oldRating !== undefined && entry.oldRating !== null
        ? entry.newRating - entry.oldRating
        : index > 0
          ? entry.newRating - history[index - 1].newRating
          : null,
  }));

  const ratings = data.map((entry) => entry.newRating).filter((value) => Number.isFinite(value));
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const padding = Math.max(60, Math.round((max - min) * 0.15));

  return (
    <div style={{ height }} role="img" aria-label={`${label} history across ${data.length} contests`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`rating-fill-${accent.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgb(var(--edge))" strokeDasharray="4 8" vertical={false} />

          <XAxis
            dataKey="index"
            tick={{ fill: 'rgb(var(--content-muted))', fontSize: 10 }}
            tickFormatter={(value) => `#${value + 1}`}
            stroke="rgb(var(--edge))"
          />
          <YAxis
            domain={[Math.max(0, min - padding), max + padding]}
            tick={{ fill: 'rgb(var(--content-muted))', fontSize: 10 }}
            stroke="rgb(var(--edge))"
            width={48}
          />

          <Tooltip content={<ChartTooltip />} />

          <Area
            type="monotone"
            dataKey="newRating"
            stroke={accent}
            strokeWidth={2}
            fill={`url(#rating-fill-${accent.replace('#', '')})`}
            dot={{ r: 2, fill: accent, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            // Draw-in animation, disabled automatically by reduced-motion CSS.
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RatingChart;
