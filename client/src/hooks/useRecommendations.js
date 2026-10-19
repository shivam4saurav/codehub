import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  fetchRecommendationHistory,
  fetchRecommendations,
} from '../api/recommendations.api.js';

/**
 * Recommendations. `nonce` participates in the query key so the shuffle button
 * forces a genuinely new draw instead of re-reading the cache.
 */
export const useRecommendationsQuery = (params, { enabled = true } = {}) => {
  const [nonce, setNonce] = useState(0);

  const query = useQuery({
    queryKey: ['recommendations', params, nonce],
    queryFn: () => fetchRecommendations({ ...params, shuffle: nonce > 0 }),
    enabled,
    staleTime: 2 * 60_000,
  });

  return { ...query, shuffle: () => setNonce((value) => value + 1), nonce };
};

export const useRecommendationHistoryQuery = ({ enabled = true, limit = 5 } = {}) =>
  useQuery({
    queryKey: ['recommendations', 'history', limit],
    queryFn: () => fetchRecommendationHistory(limit),
    enabled,
    staleTime: 60_000,
  });

export default useRecommendationsQuery;
