import cn from '../../utils/cn.js';

const VARIANTS = {
  neutral: 'border-edge bg-surface-inset text-content-secondary',
  brand: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  cyan: 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan',
  success: 'border-state-success/40 bg-state-success/10 text-state-success',
  warning: 'border-state-warning/40 bg-state-warning/10 text-state-warning',
  danger: 'border-state-danger/40 bg-state-danger/10 text-state-danger',
  leetcode: 'border-platform-leetcode/40 bg-platform-leetcode/10 text-platform-leetcode',
  codeforces: 'border-platform-codeforces/40 bg-platform-codeforces/10 text-platform-codeforces',
  codechef: 'border-platform-codechef/40 bg-platform-codechef/10 text-platform-codechef',
};

const SIZES = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export const Badge = ({
  variant = 'neutral',
  size = 'sm',
  icon: Icon,
  className,
  children,
  ...props
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md border font-medium leading-none',
      VARIANTS[variant] ?? VARIANTS.neutral,
      SIZES[size] ?? SIZES.sm,
      className,
    )}
    {...props}
  >
    {Icon ? <Icon size={size === 'xs' ? 10 : 12} aria-hidden="true" /> : null}
    {children}
  </span>
);

export default Badge;
