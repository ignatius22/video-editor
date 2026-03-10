import { createContext, useContext, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/client';
import { queryKeys } from '@/lib/queryKeys';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const {
    data: user = null,
    isLoading: loading,
    refetch: refetchUser,
  } = useQuery({
    queryKey: queryKeys.auth.user,
    queryFn: async () => {
      const data = await api.getUser();
      return data.user || data;
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }) => api.login(username, password),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.user, data.user || data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ username, email, password }) => api.register(username, email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.user, data.user || data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.user, null);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await refetchUser();
      return data;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, [refetchUser]);

  const login = useCallback(async (username, password) => {
    return loginMutation.mutateAsync({ username, password });
  }, [loginMutation]);

  const register = useCallback(async (username, email, password) => {
    return registerMutation.mutateAsync({ username, email, password });
  }, [registerMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
