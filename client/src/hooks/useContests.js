import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchContests } from '../api/contests.api.js';
import { cancelReminder, createReminder, fetchReminders } from '../api/reminders.api.js';
import { useToast } from '../context/ToastContext.jsx';

export const useContestsQuery = (params) =>
  useQuery({
    queryKey: ['contests', params],
    queryFn: () => fetchContests(params),
    // Contests move slowly; the countdowns tick client-side.
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

export const useRemindersQuery = ({ enabled = true, ...params } = {}) =>
  useQuery({
    queryKey: ['reminders', params],
    queryFn: () => fetchReminders(params),
    enabled,
    staleTime: 30_000,
  });

/** Create/cancel reminders, keeping both the calendar and the list in sync. */
export const useReminderMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reminders'] });

  const create = useMutation({
    mutationFn: createReminder,
    onSuccess: (data) => {
      invalidate();
      toast.success('Reminder set', data.message);
    },
    onError: (error) => toast.error('Could not set reminder', error.message),
  });

  const cancel = useMutation({
    mutationFn: cancelReminder,
    onSuccess: () => {
      invalidate();
      toast.success('Reminder cancelled');
    },
    onError: (error) => toast.error('Could not cancel reminder', error.message),
  });

  return {
    createReminder: create.mutateAsync,
    cancelReminder: cancel.mutate,
    isCreating: create.isPending,
    isCancelling: cancel.isPending,
  };
};

export default useContestsQuery;
