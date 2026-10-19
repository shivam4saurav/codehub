import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { PLATFORMS } from '../../utils/platform.js';
import { EmptyState } from '../ui/States.jsx';

const SERIES = [
  { key: 'codeforces', label: PLATFORMS.codeforces.label, color: PLATFORMS.codeforces.accent },
  { key: 'leetcode', label: PLATFORMS.leetcode.label, color: PLATFORMS.leetcode.accent },
  { key: 'codechef', label: PLATFORMS.codechef.label, color: PLATFORMS.codechef.accent },
];

const RadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <div className="glass-strong p-3 text-xs">
      <p className="font-medium text-content-primary">{row.name}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-content-secondary">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            {entry.name}: <span className="font-mono">{entry.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 font-mono text-content-muted">Total {row.total}</p>
    </div>
  );
};

/**
 * Platform comparison across canonical topics. Because topics are normalised,
 * a Codeforces "dp" solve and a LeetCode "Dynamic Programming" solve land on
 * the same axis - which is the whole point of the taxonomy.
 */
export const TopicRadar = ({ data = [], activePlatforms = [], height = 320 }) => {
  if (data.length < 3) {
    return (
      <EmptyState
        title="Not enough topic data yet"
        description="Solve problems in at least three topics to see the comparison radar."
        className="py-8"
      />
    );
  }

  const series = SERIES.filter((entry) => activePlatforms.includes(entry.key));

  return (
    <div
      style={{ height }}
      role="img"
      aria-label={`Topic comparison across ${series.map((entry) => entry.label).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgb(var(--edge))" />
          <PolarAngleAxis
            dataKey="topic"
            tick={{ fill: 'rgb(var(--content-secondary))', fontSize: 11 }}
          />
          <PolarRadiusAxis
            tick={{ fill: 'rgb(var(--content-muted))', fontSize: 9 }}
            stroke="rgb(var(--edge))"
            angle={90}
          />

          <Tooltip content={<RadarTooltip />} />
          {series.length > 1 ? (
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'rgb(var(--content-secondary))' }}
              iconType="circle"
            />
          ) : null}

          {series.map((entry) => (
            <Radar
              key={entry.key}
              name={entry.label}
              dataKey={entry.key}
              stroke={entry.color}
              fill={entry.color}
              fillOpacity={0.22}
              strokeWidth={2}
              animationDuration={800}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TopicRadar;
