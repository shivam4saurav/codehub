import { useQuery } from '@tanstack/react-query';

import api from '../api/axios.js';

/**
 * Polls /api/health so the footer can show honest status instead of pretending
 * everything is fine when LeetCode or CodeChef is down.
 */
export const useSourceHealth = ({ enabled = true } = {}) => {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((response) => response.data),
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const data = query.data;

  const status = !data
    ? 'unknown'
    : data.degraded
      ? data.sources?.some((source) => source.status === 'down')
        ? 'down'
        : 'degraded'
      : 'ok';

  return {
    ...query,
    health: data ?? null,
    sources: data?.sources ?? [],
    status,
  };
};

export default useSourceHealth;
