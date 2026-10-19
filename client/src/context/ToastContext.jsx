import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import cn from '../utils/cn.js';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONES = {
  success: 'border-state-success/40 text-state-success',
  error: 'border-state-danger/40 text-state-danger',
  warning: 'border-state-warning/40 text-state-warning',
  info: 'border-brand-400/40 text-brand-300',
};

let counter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, description = '', variant = 'info', duration = 4500 }) => {
      counter += 1;
      const id = `toast-${counter}`;

      setToasts((current) => [...current.slice(-3), { id, title, description, variant }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      notify,
      dismiss,
      success: (title, description) => notify({ title, description, variant: 'success' }),
      error: (title, description) => notify({ title, description, variant: 'error' }),
      warning: (title, description) => notify({ title, description, variant: 'warning' }),
      info: (title, description) => notify({ title, description, variant: 'info' }),
    }),
    [notify, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Polite live region: announced by screen readers without stealing focus. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.variant] ?? Info;

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'glass-strong pointer-events-auto flex w-full max-w-md items-start gap-3 border px-4 py-3',
                  TONES[toast.variant] ?? TONES.info,
                )}
                role="status"
              >
                <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-content-primary">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-0.5 break-words text-xs text-content-secondary">
                      {toast.description}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="focus-ring rounded-md p-1 text-content-muted transition hover:text-content-primary"
                  aria-label="Dismiss notification"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
};

export default ToastContext;
