import cn from '../../utils/cn.js';

/** Horizontal progress bar with accessible value reporting. */
export const ProgressBar = ({
  value = 0,
  max = 100,
  label,
  showValue = true,
  color = 'brand',
  size = 'md',
  className,
}) => {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));

  const fills = {
    brand: 'bg-brand-500',
    success: 'bg-state-success',
    warning: 'bg-state-warning',
    danger: 'bg-state-danger',
    cyan: 'bg-accent-cyan',
  };

  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };

  return (
    <div className={cn('w-full', className)}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          {label ? <span className="truncate text-content-secondary">{label}</span> : null}
          {showValue ? (
            <span className="shrink-0 font-mono text-content-muted">
              {value}/{max}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ? `${label} progress` : 'Progress'}
        className={cn('w-full overflow-hidden rounded-full bg-surface-inset', heights[size])}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-spring', fills[color])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

/** Circular progress ring used for topic mastery and profile completeness. */
export const ProgressRing = ({
  value = 0,
  max = 100,
  size = 96,
  thickness = 8,
  label,
  sublabel,
  color = '#2b9a5c',
  trackColor = 'rgb(var(--surface-inset))',
  className,
}) => {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <div className={cn('relative inline-grid place-items-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label ?? 'Progress'}: ${Math.round(percent)}%`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-lg font-semibold leading-none text-content-primary">
            {Math.round(percent)}%
          </p>
          {sublabel ? <p className="mt-0.5 text-[10px] text-content-muted">{sublabel}</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
