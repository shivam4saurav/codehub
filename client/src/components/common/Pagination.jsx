import { ChevronLeft, ChevronRight } from 'lucide-react';

import cn from '../../utils/cn.js';
import Button from '../ui/Button.jsx';

/** Windowed page numbers with ellipses, e.g. 1 … 7 8 [9] 10 11 … 42 */
const pageWindow = (current, total, span = 1) => {
  const pages = new Set([1, total]);

  for (let page = current - span; page <= current + span; page += 1) {
    if (page > 1 && page < total) pages.add(page);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const output = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) output.push('gap');
    output.push(page);
  });

  return output;
};

export const Pagination = ({ pagination, onPageChange, className }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <p className="text-xs text-content-muted" aria-live="polite">
        Showing <span className="font-mono text-content-secondary">{from.toLocaleString()}</span>–
        <span className="font-mono text-content-secondary">{to.toLocaleString()}</span> of{' '}
        <span className="font-mono text-content-secondary">{total.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </Button>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-content-muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'focus-ring h-9 min-w-9 rounded-lg px-2.5 text-sm font-medium transition',
                entry === page
                  ? 'bg-brand-gradient text-white'
                  : 'text-content-secondary hover:bg-surface-raised hover:text-content-primary',
              )}
            >
              {entry}
            </button>
          ),
        )}

        <Button
          variant="secondary"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNext}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
};

export default Pagination;
