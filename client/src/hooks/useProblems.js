import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteBookmark,
  fetchBookmarks,
  fetchFacets,
  fetchProblems,
  fetchRawTags,
  fetchTopicProgress,
  saveBookmark,
} from '../api/problems.api.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Problem list. keepPreviousData means paging and filter tweaks never flash an
 * empty table - the old rows stay until the new page resolves.
 */
export const useProblemsQuery = (params, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['problems', 'list', params],
    queryFn: () => fetchProblems(params),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 60_000,
  });

export const useFacetsQuery = (platform) =>
  useQuery({
    queryKey: ['problems', 'facets', platform ?? 'all'],
    queryFn: () => fetchFacets({ platform }),
    staleTime: 10 * 60_000,
  });

export const useRawTagsQuery = (platform, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['problems', 'raw-tags', platform],
    queryFn: () => fetchRawTags({ platform }),
    enabled,
    staleTime: 10 * 60_000,
  });

export const useTopicProgressQuery = ({ platform, handle, enabled = true }) =>
  useQuery({
    queryKey: ['problems', 'progress', platform, handle ?? null],
    queryFn: () => fetchTopicProgress({ platform, handle }),
    enabled,
    staleTime: 5 * 60_000,
  });

export const useBookmarksQuery = (params, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['bookmarks', params],
    queryFn: () => fetchBookmarks(params),
    enabled,
    staleTime: 30_000,
  });

/**
 * Bookmark/note/done mutations. Every success invalidates the problem list so
 * the inline bookmark state in the table stays truthful.
 */
export const useBookmarkMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['problems', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
  };

  const save = useMutation({
    mutationFn: saveBookmark,
    onSuccess: invalidate,
    onError: (error) => toast.error('Could not save', error.message),
  });

  const remove = useMutation({
    mutationFn: deleteBookmark,
    onSuccess: invalidate,
    onError: (error) => toast.error('Could not remove bookmark', error.message),
  });

  return {
    toggleBookmark: (problem) =>
      problem.bookmark?.bookmarked
        ? remove.mutate(problem.id)
        : save.mutate({ problemId: problem.id, bookmarked: true }),
    setNote: (problemId, note) => save.mutateAsync({ problemId, bookmarked: true, note }),
    setDone: (problemId, done) => save.mutate({ problemId, bookmarked: true, done }),
    isSaving: save.isPending || remove.isPending,
  };
};

export default useProblemsQuery;
