'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Me, NextStep } from '@edventure/contracts';
import { api } from './api';

export const meKey = ['me'] as const;

export function useSession() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api.get<{ me: Me; next: NextStep }>('/me'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    window.location.assign('/login');
  };
}

/** Where to send the user after sign-in based on the pending step. */
export function routeForNext(next: NextStep, fallback = '/admin') {
  if (next === 'change_password') return '/change-password';
  if (next === 'mfa_enroll' || next === 'mfa_verify') return '/mfa';
  return fallback;
}
