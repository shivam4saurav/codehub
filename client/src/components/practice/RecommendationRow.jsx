import { Bookmark, BookmarkCheck, Check, ExternalLink } from 'lucide-react';

import cn from '../../utils/cn.js';
import { formatCompact } from '../../utils/format.js';
import { difficultyColor, getPlatform, ratingTier } from '../../utils/platform.js';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * One recommended problem, as a row in a list.
 *
 * The reason line is the important part: a suggestion you cannot question is
 * one you will not trust, so every row says which weak topic it came from and
 * the numbers behind that.
 */
export const RecommendationRow = ({
  item,
  onToggleBookmark,
  onMarkDone,
  isBookmarked,
  isDone,
  compact = false,
}) => {
  const platform = getPlatform(item.platform);
  const tier = ratingTier(item.rating);
  const code = item.platform === 'codeforces' && item.externalId ? item.externalId : platform.short;

  return (
    <li className={cn('flex gap-4 px-4 py-3.5', isDone && 'opacity-60')}>
      <div className="w-14 shrink-0 pt-0.5 text-right">
        {item.rating && item.platform === 'codeforces' ? (
          <Tooltip content={tier.name}>
            <span className="font-mono text-sm font-semibold tabular" style={{ color: tier.color }}>
              {item.rating}
            </span>
          </Tooltip>
        ) : item.difficulty ? (
          <span className="text-sm font-medium" style={{ color: difficultyColor(item.difficulty) }}>
            {item.difficulty}
          </span>
        ) : (
          <span className="text-sm text-content-muted">-</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs text-content-muted">{code}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'focus-ring group inline-flex min-w-0 items-baseline gap-1 rounded font-medium text-content-primary hover:underline',
              isDone && 'line-through decoration-content-muted',
            )}
          >
            <span className="truncate">{item.name}</span>
            <ExternalLink
              size={12}
              className="shrink-0 self-center text-content-muted opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </a>
        </p>

        <p className="mt-1 text-[13px] leading-relaxed text-content-secondary">{item.reason}</p>

        {!compact ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
            <span>
              Topic: <span className="text-content-secondary">{item.topicName}</span>
            </span>
            {item.solvedCount > 0 ? <span>{formatCompact(item.solvedCount)} solved it</span> : null}
            {item.targetWindow?.label && item.targetWindow.label !== 'target' ? (
              <Tooltip content="Not enough problems in your ideal rating range, so the range was widened.">
                <span className="underline decoration-dotted underline-offset-2">range widened</span>
              </Tooltip>
            ) : null}
          </p>
        ) : null}
      </div>

      {!compact && (onToggleBookmark || onMarkDone) ? (
        <div className="flex shrink-0 items-start gap-1">
          {onToggleBookmark ? (
            <Tooltip content={isBookmarked ? 'Remove from saved' : 'Save for later'}>
              <button
                type="button"
                onClick={() => onToggleBookmark(item)}
                aria-pressed={Boolean(isBookmarked)}
                aria-label={isBookmarked ? `Remove ${item.name} from saved` : `Save ${item.name}`}
                className={cn(
                  'focus-ring rounded-md p-1.5 transition-colors hover:bg-surface-inset',
                  isBookmarked ? 'text-brand-300' : 'text-content-muted hover:text-content-primary',
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

          {onMarkDone ? (
            <Tooltip content={isDone ? 'Mark as not done' : 'Mark as done'}>
              <button
                type="button"
                onClick={() => onMarkDone(item)}
                aria-pressed={Boolean(isDone)}
                aria-label={isDone ? `Mark ${item.name} as not done` : `Mark ${item.name} as done`}
                className={cn(
                  'focus-ring rounded-md border p-1 transition-colors',
                  isDone
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-edge-strong text-transparent hover:text-content-muted',
                )}
              >
                <Check size={13} strokeWidth={3} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

export default RecommendationRow;
