import { Award, ExternalLink, Flame, Star, TrendingUp, Trophy, Users } from 'lucide-react';

import { formatNumber } from '../../utils/format.js';
import { PLATFORMS, ratingTier } from '../../utils/platform.js';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import Badge from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { ProgressBar } from '../ui/Progress.jsx';
import { ErrorState, StaleBadge } from '../ui/States.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import RatingChart from './RatingChart.jsx';

/** Shared chrome for the three platform cards, including per-platform status. */
const PlatformShell = ({ platform, handle, status, children, onRetry }) => {
  const meta = PLATFORMS[platform];

  return (
    <Card className="flex h-full flex-col">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-content-primary">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: meta.accent }}
              aria-hidden="true"
            />
            {meta.label}
          </h2>
          {handle ? (
            <a
              href={meta.profileUrl(handle)}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mt-0.5 inline-flex items-center gap-1 rounded font-mono text-xs text-content-muted hover:text-content-primary"
            >
              {handle}
              <ExternalLink size={10} aria-hidden="true" />
            </a>
          ) : null}
        </div>

        {status?.stale ? (
          <StaleBadge fetchedAt={status.fetchedAt} reason={status.staleReason} />
        ) : status?.ok ? (
          <Badge variant="success" size="xs">
            Live
          </Badge>
        ) : null}
      </header>

      {status && !status.ok ? (
        <ErrorState
          compact
          title={`${meta.label} is unavailable`}
          error={{ message: status.error }}
          onRetry={onRetry}
        />
      ) : (
        children
      )}
    </Card>
  );
};

const Stat = ({ label, value, hint, color }) => (
  <div>
    <p className="text-xs text-content-muted">{label}</p>
    <p
      className="font-mono text-lg font-semibold text-content-primary tabular"
      style={color ? { color } : undefined}
    >
      {value}
    </p>
    {hint ? <p className="text-[11px] text-content-muted">{hint}</p> : null}
  </div>
);

export const CodeforcesCard = ({ data, handle, status, onRetry }) => {
  const tier = ratingTier(data?.rating);

  return (
    <PlatformShell platform="codeforces" handle={handle} status={status} onRetry={onRetry}>
      {data ? (
        <div className="flex flex-1 flex-col">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Rating"
              value={data.rating ? <AnimatedNumber value={data.rating} /> : 'Unrated'}
              hint={data.rank ?? tier.name}
              color={tier.color}
            />
            <Stat
              label="Max rating"
              value={data.maxRating ? <AnimatedNumber value={data.maxRating} /> : '—'}
              hint={data.maxRank ?? undefined}
            />
            <Stat label="Solved" value={<AnimatedNumber value={data.solvedCount ?? 0} />} />
            <Stat label="Contests" value={formatNumber(data.contestsCount ?? 0)} />
          </div>

          {data.contribution || data.friendOfCount ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.friendOfCount ? (
                <Badge variant="neutral" icon={Users} size="xs">
                  {formatNumber(data.friendOfCount)} friends
                </Badge>
              ) : null}
              {data.contribution ? (
                <Badge variant="neutral" icon={TrendingUp} size="xs">
                  Contribution {data.contribution}
                </Badge>
              ) : null}
              {data.organization ? (
                <Badge variant="neutral" size="xs">
                  {data.organization}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex-1">
            <p className="mb-2 text-xs font-medium text-content-secondary">Rating history</p>
            <RatingChart
              history={data.ratingHistory ?? []}
              accent={PLATFORMS.codeforces.accent}
              label="Codeforces rating"
            />
          </div>

          {!data.activityAvailable ? (
            <p className="mt-3 text-xs text-state-warning">
              Submission history was unavailable, so solved counts and topics may be incomplete.
            </p>
          ) : null}
        </div>
      ) : null}
    </PlatformShell>
  );
};

export const LeetCodeCard = ({ data, handle, status, onRetry }) => (
  <PlatformShell platform="leetcode" handle={handle} status={status} onRetry={onRetry}>
    {data ? (
      <div className="flex flex-1 flex-col">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Solved" value={<AnimatedNumber value={data.solved?.total ?? 0} />} hint={`of ${formatNumber(data.totals?.all ?? 0)}`} />
          <Stat
            label="Contest rating"
            value={data.contestRating ? <AnimatedNumber value={data.contestRating} /> : '—'}
            hint={data.contestsCount ? `${data.contestsCount} contests` : undefined}
          />
          <Stat
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1">
                <Flame size={15} className="text-accent-amber" aria-hidden="true" />
                {data.streak ?? 0}
              </span>
            }
            hint={`${formatNumber(data.totalActiveDays ?? 0)} active days`}
          />
          <Stat
            label="Global rank"
            value={data.globalRanking ? formatNumber(data.globalRanking) : '—'}
            hint={data.topPercentage ? `Top ${data.topPercentage}%` : undefined}
          />
        </div>

        <div className="mt-5 space-y-2.5">
          {[
            { key: 'easy', label: 'Easy', color: 'success' },
            { key: 'medium', label: 'Medium', color: 'warning' },
            { key: 'hard', label: 'Hard', color: 'danger' },
          ].map((row) => (
            <ProgressBar
              key={row.key}
              label={row.label}
              value={data.solved?.[row.key] ?? 0}
              max={data.totals?.[row.key] ?? 1}
              color={row.color}
              size="sm"
            />
          ))}
        </div>

        {data.badges?.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-content-secondary">Badges</p>
            <div className="flex flex-wrap gap-1.5">
              {data.badges.map((badge) => (
                <Tooltip key={badge.id} content={badge.name}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-edge/70 bg-surface-inset/60 px-2 py-1 text-[11px] text-content-secondary">
                    <Award size={11} className="text-accent-amber" aria-hidden="true" />
                    <span className="max-w-[9rem] truncate">{badge.name}</span>
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
        ) : null}

        {data.ratingHistory?.length > 1 ? (
          <div className="mt-5 flex-1">
            <p className="mb-2 text-xs font-medium text-content-secondary">Contest rating</p>
            <RatingChart
              history={data.ratingHistory}
              accent={PLATFORMS.leetcode.accent}
              height={180}
              label="LeetCode contest rating"
            />
          </div>
        ) : null}
      </div>
    ) : null}
  </PlatformShell>
);

export const CodeChefCard = ({ data, handle, status, onRetry }) => (
  <PlatformShell platform="codechef" handle={handle} status={status} onRetry={onRetry}>
    {data ? (
      <div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Rating"
            value={data.rating ? <AnimatedNumber value={data.rating} /> : '—'}
            hint={data.maxRating ? `max ${data.maxRating}` : undefined}
          />
          <Stat
            label="Stars"
            value={
              <span className="inline-flex items-center gap-1 text-accent-amber">
                {data.stars ?? '—'}
                {data.stars ? <Star size={14} aria-hidden="true" /> : null}
              </span>
            }
          />
          <Stat
            label="Global rank"
            value={data.globalRank ? formatNumber(data.globalRank) : '—'}
          />
          <Stat
            label="Country rank"
            value={data.countryRank ? formatNumber(data.countryRank) : '—'}
            hint={data.country ?? undefined}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="codechef" icon={Trophy} size="md">
            {formatNumber(data.problemsSolved ?? 0)} solved
          </Badge>
          {data.partiallySolved ? (
            <Badge variant="neutral" size="md">
              {formatNumber(data.partiallySolved)} partial
            </Badge>
          ) : null}
        </div>

        <p className="mt-4 text-xs text-content-muted">
          CodeChef has no public API, so these numbers are read from the public profile page and
          cached. Topic-level data is not exposed there.
        </p>
      </div>
    ) : null}
  </PlatformShell>
);

export default { CodeforcesCard, LeetCodeCard, CodeChefCard };
