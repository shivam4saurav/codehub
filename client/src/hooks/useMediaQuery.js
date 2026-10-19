import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * Uses useSyncExternalStore rather than useState + useEffect: matchMedia is an
 * external store, and this is the API React 18 provides for reading one without
 * tearing (and without a setState inside an effect body).
 */
export const useMediaQuery = (query) => {
  const subscribe = useCallback(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // No SSR in this app, but a server snapshot keeps the hook safe to reuse.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

export default useMediaQuery;
