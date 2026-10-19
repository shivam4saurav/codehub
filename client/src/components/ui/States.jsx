import { AlertTriangle, Clock3, Inbox, RefreshCw, WifiOff } from 'lucide-react';

import cn from '../../utils/cn.js';
import Button from './Button.jsx';

/** Nothing here yet - always offers the next useful action. */
export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-edge-strong px-6 py-12 text-center',
      className,
    )}
  >
    <Icon size={22} className="text-content-muted" aria-hidden="true" />

    <div>
      <p className="text-base font-semibold text-content-primary">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-content-secondary">
          {description}
        </p>
      ) : null}
    </div>

    {action}
  </div>
);

/** Something failed - shows the reason and a retry, never a blank screen. */
export const ErrorState = ({
  title = 'Could not load this',
  error,
  onRetry,
  className,
  compact = false,
}) => {
  const isNetwork = error?.isNetworkError;
  const Icon = isNetwork ? WifiOff : AlertTriangle;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border border-state-danger/30 bg-state-danger/5 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <Icon size={20} className="text-state-danger" aria-hidden="true" />

      <div>
        <p className="text-base font-semibold text-content-primary">{title}</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-content-secondary">
          {error?.message ??
            (isNetwork
              ? 'We could not reach the CodeHub server. Check your connection and try again.'
              : 'An unexpected error occurred.')}
        </p>
      </div>

      {onRetry ? (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
};

/** "Last updated 3h ago" badge for stale-while-error data. */
export const StaleBadge = ({ fetchedAt, reason, className }) => {
  if (!fetchedAt) return null;

  const label = relativeTime(fetchedAt);
  const explanation =
    reason === 'source-shape-changed'
      ? 'The platform changed its response format, so CodeHub is showing the last saved copy.'
      : 'The platform did not respond, so CodeHub is showing the last saved copy.';

  return (
    <span
      title={explanation}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-state-warning/40 bg-state-warning/10 px-2.5 py-1 text-xs font-medium text-state-warning',
        className,
      )}
    >
      <Clock3 size={12} aria-hidden="true" />
      Last updated {label}
      <span className="sr-only">. {explanation}</span>
    </span>
  );
};

export const relativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'recently';

  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  return `${months}mo ago`;
};

export default EmptyState;
