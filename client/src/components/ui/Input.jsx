import { ChevronDown } from 'lucide-react';
import { forwardRef, useId } from 'react';

import cn from '../../utils/cn.js';

const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-content-primary';

const FIELD_CLASS =
  'focus-ring w-full rounded-lg border bg-surface-raised text-sm text-content-primary ' +
  'placeholder:text-content-muted transition duration-150 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Labelled text input with inline validation messaging.
 * Errors are wired through aria-describedby + aria-invalid so assistive tech
 * announces them, not just the red border.
 */
export const Input = forwardRef(
  (
    { label, hint, error, icon: Icon, className, containerClassName, id, type = 'text', ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = [error && `${inputId}-error`, hint && `${inputId}-hint`]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={cn('w-full', containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className={LABEL_CLASS}>
            {label}
          </label>
        ) : null}

        <div className="relative">
          {Icon ? (
            <Icon
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
            />
          ) : null}

          <input
            ref={ref}
            id={inputId}
            type={type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              FIELD_CLASS,
              'h-10 px-3',
              Icon && 'pl-9',
              error ? 'border-state-danger/70' : 'border-edge-strong hover:border-content-muted/60',
              className,
            )}
            {...props}
          />
        </div>

        {hint && !error ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-content-muted">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-state-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export const Textarea = forwardRef(
  ({ label, hint, error, className, id, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className={LABEL_CLASS}>
            {label}
          </label>
        ) : null}

        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            FIELD_CLASS,
            'resize-y px-3 py-2.5',
            error ? 'border-state-danger/70' : 'border-edge-strong hover:border-content-muted/60',
            className,
          )}
          {...props}
        />

        {hint && !error ? <p className="mt-1.5 text-xs text-content-muted">{hint}</p> : null}
        {error ? (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-state-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

/**
 * Native <select> (best keyboard and screen-reader support) with a drawn
 * chevron. `className` styles the field; `containerClassName` sizes the whole
 * control, which is what matters when selects sit side by side in a flex row.
 */
export const Select = forwardRef(
  ({ label, error, className, containerClassName, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className={cn('w-full', containerClassName)}>
        {label ? (
          <label htmlFor={selectId} className={LABEL_CLASS}>
            {label}
          </label>
        ) : null}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              FIELD_CLASS,
              'h-10 cursor-pointer appearance-none px-3 pr-9',
              error ? 'border-state-danger/70' : 'border-edge-strong hover:border-content-muted/60',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-content-muted"
          />
        </div>

        {error ? <p className="mt-1.5 text-xs text-state-danger">{error}</p> : null}
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Input;
