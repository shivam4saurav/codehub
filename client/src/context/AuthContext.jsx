import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  registerRequest,
  updateProfileRequest,
} from '../api/auth.api.js';
import { onAuthExpired } from '../api/axios.js';

const AuthContext = createContext(null);

export const AUTH_QUERY_KEY = ['auth', 'me'];

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();

  /**
   * The session lives in httpOnly cookies, so "am I signed in?" is a server
   * question. A 401 here is a normal guest response, not an error to retry.
   */
  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchCurrentUser();
      } catch (error) {
        if (error.status === 401) return null;
        throw error;
      }
    },
    // A 401 is a real answer ("guest"). A timeout or 5xx is not: retry those,
    // otherwise a signed-in user looks logged out while the server wakes up.
    retry: (failureCount, error) =>
      failureCount < 2 && (error?.isNetworkError || (error?.status ?? 0) >= 500),
    staleTime: 5 * 60 * 1000,
  });

  const setUser = useCallback(
    (nextUser) => queryClient.setQueryData(AUTH_QUERY_KEY, nextUser ?? null),
    [queryClient],
  );

  // A failed token refresh means the session is gone: drop cached private data.
  useEffect(
    () =>
      onAuthExpired(() => {
        setUser(null);
        queryClient.removeQueries({ queryKey: ['bookmarks'] });
        queryClient.removeQueries({ queryKey: ['reminders'] });
        queryClient.removeQueries({ queryKey: ['recommendations'] });
      }),
    [queryClient, setUser],
  );

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: setUser,
  });

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: setUser,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      setUser(null);
      queryClient.clear();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateProfileRequest,
    onSuccess: setUser,
  });

  const value = useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: Boolean(user),
      isLoading,
      login: loginMutation.mutateAsync,
      register: registerMutation.mutateAsync,
      logout: logoutMutation.mutateAsync,
      updateProfile: updateProfileMutation.mutateAsync,
      loginState: { isPending: loginMutation.isPending, error: loginMutation.error },
      registerState: { isPending: registerMutation.isPending, error: registerMutation.error },
      updateProfileState: {
        isPending: updateProfileMutation.isPending,
        error: updateProfileMutation.error,
      },
      setUser,
    }),
    [
      user,
      isLoading,
      loginMutation.mutateAsync,
      loginMutation.isPending,
      loginMutation.error,
      registerMutation.mutateAsync,
      registerMutation.isPending,
      registerMutation.error,
      logoutMutation.mutateAsync,
      updateProfileMutation.mutateAsync,
      updateProfileMutation.isPending,
      updateProfileMutation.error,
      setUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};

export default AuthContext;
