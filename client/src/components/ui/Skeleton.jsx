import cn from '../../utils/cn.js';

/** Shimmer placeholder. Always paired with a real aria-busy container. */
export const Skeleton = ({ className, ...props }) => (
  <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" {...props} />
);

export const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)} aria-hidden="true">
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className }) => (
  <div className={cn('glass space-y-4 p-5', className)} aria-hidden="true">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonGrid = ({ count = 6, className, cardClassName }) => (
  <div
    className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
    role="status"
    aria-busy="true"
    aria-label="Loading content"
  >
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} className={cardClassName} />
    ))}
  </div>
);

export default Skeleton;
