import { Loader2 } from 'lucide-react';

import cn from '../../utils/cn.js';

export const LoadingScreen = ({ label = 'Loading CodeHub…', className, compact = false }) => (
  <div
    role="status"
    aria-live="polite"
    className={cn(
      'flex w-full flex-col items-center justify-center gap-3 text-content-secondary',
      compact ? 'py-12' : 'min-h-[60vh]',
      className,
    )}
  >
    <Loader2 size={22} className="animate-spin text-brand-300" aria-hidden="true" />
    <p className="text-sm">{label}</p>
  </div>
);

export default LoadingScreen;
