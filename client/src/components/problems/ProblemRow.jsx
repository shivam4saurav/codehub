import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  NotebookPen,
  Target,
} from 'lucide-react';

import cn from '../../utils/cn.js';
import { difficultyColor, ratingTier } from '../../utils/platform.js';
import Badge from '../ui/Badge.jsx';
import Tooltip from '../ui/Tooltip.jsx';

const STATUS_META = {
  solved: { label: 'Solved', icon: CheckCircle2, className: 'text-state-success' },
  attempted: { label: 'Attempted', icon: Target, className: 'text-state-warning' },
  unsolved: { label: 'Unsolved', icon: CircleDashed, className: 'text-content-muted' },
};

/**
 * One problem row. Reads as a card on mobile and a dense row on desktop.
 * Topic chips show canonical topics by default and raw platform tags when the
 * browser is in raw mode, so the label always matches the active filter.
 */
export const ProblemRow = ({
  problem,
  topicLookup,
  tagMode = 'canonical',
  onToggleBookmark,
  onOpenNote,
  onToggleDone,
  showStatus,
}) => {
  const status = STATUS_META[problem.userStatus] ?? null;
  const StatusIcon = status?.icon;
  const tier = ratingTier(problem.rating);
  const isBookmarked = problem.bookmark?.bookmarked;
  const isDone = problem.bookmark?.done;
  const hasNote = Boolean(problem.bookmark?.note);

  const tags =
    tagMode === 'raw'
      ? (problem.rawTags ?? []).map((tag) => ({ key: tag, name: tag, accent: '#7d786e' }))
      : (problem.canonicalTopics ?? []).map((key) => ({
          key,
          name: topicLookup?.get(key)?.name ?? key,
          accent: topicLookup?.get(key)?.accent ?? '#7d786e',
        }));

  return (
    <article
      className={cn(
        'glass card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4',
        isDone && 'opacity-75',
      )}
    >
      {showStatus && status ? (
        <Tooltip content={status.label}>
          <span className={cn('hidden shrink-0 sm:block', status.className)}>
            <StatusIcon size={18} aria-hidden="true" />
            <span className="sr-only">{status.label}</span>
          </span>
        </Tooltip>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {problem.platform === 'codeforces' && problem.externalId ? (
            <span className="font-mono text-xs text-content-muted">{problem.externalId}</span>
          ) : null}

          {problem.platform === 'leetcode' && problem.index ? (
            <span className="font-mono text-xs text-content-muted">#{problem.index}</span>
          ) : null}

          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'focus-ring group inline-flex items-center gap-1.5 rounded text-sm font-medium text-content-primary hover:text-brand-200',
              isDone && 'line-through decoration-content-muted',
            )}
          >
            {problem.name}
            <ExternalLink
              size={12}
              className="opacity-0 transition group-hover:opacity-100"
              aria-hidden="true"
            />
            <span className="sr-only">(opens on {problem.platform})</span>
          </a>

          {problem.isPremium ? (
            <Badge variant="warning" size="xs">
              Premium
            </Badge>
          ) : null}

          {showStatus && status && problem.userStatus !== 'unsolved' ? (
            <Badge
              variant={problem.userStatus === 'solved' ? 'success' : 'warning'}
              size="xs"
              className="sm:hidden"
            >
              {status.label}
            </Badge>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag.key}
              className="inline-flex items-center gap-1 rounded-full border border-edge/70 bg-surface-inset/60 px-2 py-0.5 text-[11px] text-content-secondary"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.accent }}
                aria-hidden="true"
              />
              {tag.name}
            </span>
          ))}

          {tags.length > 4 ? (
            <Tooltip content={tags.slice(4).map((tag) => tag.name).join(', ')}>
              <span className="rounded-full border border-edge/70 px-2 py-0.5 text-[11px] text-content-muted">
                +{tags.length - 4}
              </span>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {problem.platform === 'codeforces' ? (
          <div className="w-16 text-right">
            {problem.rating ? (
              <>
                <p className="font-mono text-sm font-semibold" style={{ color: tier.color }}>
                  {problem.rating}
                </p>
                <p className="text-[10px] text-content-muted">{tier.name}</p>
              </>
            ) : (
              <p className="font-mono text-xs text-content-muted">Unrated</p>
            )}
          </div>
        ) : (
          <div className="w-16 text-right">
            <p
              className="text-sm font-semibold"
              style={{ color: difficultyColor(problem.difficulty) }}
            >
              {problem.difficulty ?? '—'}
            </p>
            {problem.acceptanceRate ? (
              <p className="text-[10px] text-content-muted">{problem.acceptanceRate}% AC</p>
            ) : null}
          </div>
        )}

        {problem.solvedCount > 0 ? (
          <Tooltip content={`${problem.solvedCount.toLocaleString()} accepted solutions`}>
            <span className="hidden w-16 text-right md:block">
              <span className="block font-mono text-xs text-content-secondary">
                {problem.solvedCount >= 1000
                  ? `${Math.round(problem.solvedCount / 1000)}k`
                  : problem.solvedCount}
              </span>
              <span className="block text-[10px] text-content-muted">solved</span>
            </span>
          </Tooltip>
        ) : (
          <span className="hidden w-16 md:block" aria-hidden="true" />
        )}

        <div className="flex items-center gap-1">
          {onToggleDone ? (
            <Tooltip content={isDone ? 'Mark as not done' : 'Mark as done'}>
              <button
                type="button"
                onClick={() => onToggleDone(problem)}
                aria-pressed={Boolean(isDone)}
                aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                className={cn(
                  'focus-ring rounded-lg p-1.5 transition hover:bg-surface-raised',
                  isDone ? 'text-state-success' : 'text-content-muted hover:text-content-primary',
                )}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {onOpenNote ? (
            <Tooltip content={hasNote ? 'Edit note' : 'Add a note'}>
              <button
                type="button"
                onClick={() => onOpenNote(problem)}
                aria-label={hasNote ? 'Edit note' : 'Add a note'}
                className={cn(
                  'focus-ring rounded-lg p-1.5 transition hover:bg-surface-raised',
                  hasNote ? 'text-accent-cyan' : 'text-content-muted hover:text-content-primary',
                )}
              >
                <NotebookPen size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          {onToggleBookmark ? (
            <Tooltip content={isBookmarked ? 'Remove bookmark' : 'Bookmark this problem'}>
              <button
                type="button"
                onClick={() => onToggleBookmark(problem)}
                aria-pressed={Boolean(isBookmarked)}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this problem'}
                className={cn(
                  'focus-ring rounded-lg p-1.5 transition hover:bg-surface-raised',
                  isBookmarked
                    ? 'text-brand-300'
                    : 'text-content-muted hover:text-content-primary',
                )}
              >
                {isBookmarked ? (
                  <BookmarkCheck size={15} aria-hidden="true" />
                ) : (
                  <Bookmark size={15} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default ProblemRow;
