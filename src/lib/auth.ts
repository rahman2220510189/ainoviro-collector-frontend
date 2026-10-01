import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface AdminUser {
  id: number;
  email: string;
}

export const meQueryKey = ['auth', 'me'] as const;

/** The logged-in admin; the query fails with 401 when nobody is logged in. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => (await api.get<{ user: AdminUser }>('/auth/me')).data.user,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await api.post<{ user: AdminUser }>('/auth/login', input, { silent: true })).data.user,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      queryClient.clear();
      // A full page load on purpose: it drops every cached query of the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
  });
}
