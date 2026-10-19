import { Loader2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { getServerWaking, subscribeServerWaking } from '../../api/axios.js';

/**
 * Shown while the first request after a quiet spell is still waiting. The API
 * runs on a free plan that sleeps when idle, so without this the page just
 * looks stuck for up to a minute.
 */
export const ServerWakeNotice = () => {
  const waking = useSyncExternalStore(subscribeServerWaking, getServerWaking, () => false);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      {waking ? (
        <p className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg border border-edge-strong bg-surface-overlay px-4 py-3 text-sm text-content-secondary shadow-overlay">
          <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-brand-300" aria-hidden="true" />
          <span>
            <span className="font-medium text-content-primary">Waking up the server.</span> It
            sleeps when nobody is using it, so this first load can take up to a minute.
          </span>
        </p>
      ) : null}
    </div>
  );
};

export default ServerWakeNotice;
