import cn from '../../utils/cn.js';

/**
 * The same header on every page: a plain title, one sentence on what the page
 * is for, actions on the right, and an optional row underneath (badges, jump
 * links). No icon tiles or callout boxes - the title should do the work.
 */
export const PageHeader = ({ eyebrow, title, description, actions, children, className }) => (
  <header className={cn('mb-6 border-b border-edge pb-5', className)}>
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-content-primary">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed text-content-secondary">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>

    {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
  </header>
);

export default PageHeader;
