import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

import cn from '../../utils/cn.js';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white border-brand-700/40 hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'bg-surface-raised text-content-primary border-edge-strong hover:bg-surface-inset',
  outline:
    'bg-transparent text-content-primary border-edge-strong hover:bg-surface-inset',
  ghost:
    'bg-transparent text-content-secondary border-transparent hover:bg-surface-inset hover:text-content-primary',
  danger:
    'bg-state-danger/10 text-state-danger border-state-danger/40 hover:bg-state-danger/20',
  success:
    'bg-state-success/10 text-state-success border-state-success/40 hover:bg-state-success/20',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-base gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
};

/**
 * Single button primitive for the whole app.
 * `loading` keeps the label in place and swaps the leading icon for a spinner,
 * so the layout never jumps and screen readers get aria-busy.
 */
export const Button = forwardRef(
  (
    {
      as: Component = 'button',
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon: Icon,
      iconRight: IconRight,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <Component
        ref={ref}
        disabled={Component === 'button' ? isDisabled : undefined}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={cn(
          'focus-ring inline-flex select-none items-center justify-center border font-medium',
          'transition duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          VARIANTS[variant] ?? VARIANTS.primary,
          SIZES[size] ?? SIZES.md,
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === 'xs' ? 13 : 16} className="animate-spin" aria-hidden="true" />
        ) : (
          Icon && <Icon size={size === 'xs' ? 13 : 16} aria-hidden="true" />
        )}

        {children}

        {IconRight && !loading ? (
          <IconRight size={size === 'xs' ? 13 : 16} aria-hidden="true" />
        ) : null}
      </Component>
    );
  },
);

Button.displayName = 'Button';

export default Button;
