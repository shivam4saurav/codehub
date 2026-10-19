import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchProfile, refreshProfile } from '../api/profile.api.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Dashboard data. `handles` may be empty for a signed-in user, in which case
 * the server falls back to their linked handles.
 */
export const useProfileQuery = (handles, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['profile', handles],
    queryFn: () => fetchProfile(handles),
    enabled,
    // Platform APIs are slow and rate limited: hold results for a while.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

/** Manual refresh with the server-enforced cooldown mirrored in the UI. */
export const useProfileRefresh = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = setInterval(() => setCooldownSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const mutation = useMutation({
    mutationFn: refreshProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', {}], data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });

      setCooldownSeconds(data.cooldownSeconds ?? 120);

      const failed = Object.entries(data.statuses ?? {}).filter(([, status]) => !status.ok);
      if (failed.length > 0) {
        toast.warning(
          'Refreshed with warnings',
          `${failed.map(([platform]) => platform).join(', ')} did not respond - showing the last saved copy.`,
        );
      } else {
        toast.success('Platform data refreshed');
      }
    },
    onError: (error) => {
      if (error.code === 'REFRESH_COOLDOWN') {
        setCooldownSeconds(error.details?.retryAfterSeconds ?? 60);
        toast.info('Just a moment', error.message);
        return;
      }
      toast.error('Refresh failed', error.message);
    },
  });

  return {
    refresh: mutation.mutate,
    isRefreshing: mutation.isPending,
    cooldownSeconds,
    canRefresh: cooldownSeconds === 0 && !mutation.isPending,
  };
};

export default useProfileQuery;
