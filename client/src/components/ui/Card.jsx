import { forwardRef } from 'react';

import cn from '../../utils/cn.js';

export const Card = forwardRef(
  ({ as: Component = 'div', hover = false, className, ...props }, ref) => (
    <Component
      ref={ref}
      className={cn('glass p-5', hover && 'card-hover', className)}
      {...props}
    />
  ),
);

Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }) => (
  <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props} />
);

export const CardTitle = ({ as: Component = 'h3', className, ...props }) => (
  <Component
    className={cn('font-display text-base font-semibold text-content-primary', className)}
    {...props}
  />
);

export const CardDescription = ({ className, ...props }) => (
  <p className={cn('mt-1 text-sm leading-relaxed text-content-secondary', className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn('text-sm text-content-secondary', className)} {...props} />
);

export const CardFooter = ({ className, ...props }) => (
  <div
    className={cn('mt-4 flex items-center gap-2 border-t border-edge pt-4', className)}
    {...props}
  />
);

export default Card;
