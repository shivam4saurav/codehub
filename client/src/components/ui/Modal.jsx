import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import cn from '../../utils/cn.js';

/**
 * Radix dialog: focus trap, Esc to close and scroll lock come for free, which
 * is exactly why we are not hand-rolling a modal.
 */
export const Modal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}) => {
  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-fade-up" />

        <RadixDialog.Content
          className={cn(
            'glass-strong fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'max-h-[85vh] overflow-y-auto p-6 data-[state=open]:animate-fade-up',
            widths[size] ?? widths.md,
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <RadixDialog.Title className="font-display text-lg font-semibold text-content-primary">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-content-secondary">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>

            <RadixDialog.Close
              className="focus-ring rounded-lg p-1.5 text-content-muted transition hover:bg-surface-raised hover:text-content-primary"
              aria-label="Close dialog"
            >
              <X size={16} aria-hidden="true" />
            </RadixDialog.Close>
          </div>

          {children}

          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export default Modal;
