import { Activity } from 'lucide-react';

import { useSourceHealth } from '../../hooks/useSourceHealth.js';
import cn from '../../utils/cn.js';

/** Slim footer: data-source status plus attribution. Navigation lives in the sidebar. */
export const Footer = () => {
  const { status, isLoading } = useSourceHealth();

  const tone =
    status === 'ok' ? 'bg-state-success' : status === 'degraded' ? 'bg-state-warning' : 'bg-state-danger';

  const label = isLoading
    ? 'Checking data sources…'
    : status === 'ok'
      ? 'All data sources working'
      : status === 'degraded'
        ? 'Some data sources are slow - showing saved data where needed'
        : 'A data source is down - showing the last saved data';

  return (
    <footer className="border-t border-edge px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs text-content-muted">
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', isLoading ? 'bg-content-muted' : tone)} aria-hidden="true" />
          {label}
          <a
            href="/api/health"
            className="focus-ring inline-flex items-center gap-1 rounded text-content-secondary hover:text-content-primary"
          >
            <Activity size={12} aria-hidden="true" />
            Details
          </a>
        </span>
        <span>
          CodeHub is a student project. Problems, ratings and contests belong to Codeforces,
          LeetCode and CodeChef.
        </span>
      </div>
    </footer>
  );
};

export default Footer;
