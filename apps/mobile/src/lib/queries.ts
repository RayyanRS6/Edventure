import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Query } from '@edventure/api-client';
import { useToast } from '@/ui/screen';
import { api, errorMessage, isNetworkError } from './api';
import { offlineCache, type CacheKey } from './offline';

export function useApi<T>(key: QueryKey, path: string | null, query?: Query, options: { staleTime?: number; refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: [...key, query ?? null],
    queryFn: () => api.get<T>(path!, { query }),
    enabled: path !== null,
    ...options,
  });
}

/**
 * Reads through the encrypted offline cache: the latest server copy is stored after every
 * successful load, and served (with its sync time) when the device cannot reach the server.
 * Only allowlisted keys (timetables, homework summaries, rosters) may be cached.
 */
export function useCachedApi<T>(cacheKey: CacheKey | null, path: string | null, query?: Query) {
  const q = useQuery({
    queryKey: ['cached', cacheKey, query ?? null],
    enabled: !!cacheKey && path !== null,
    queryFn: async (): Promise<{ data: T; savedAt: number; fromCache: boolean }> => {
      try {
        const data = await api.get<T>(path!, { query });
        await offlineCache.set(cacheKey!, data).catch(() => undefined);
        return { data, savedAt: Date.now(), fromCache: false };
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        const stored = await offlineCache.get<T>(cacheKey!).catch(() => null);
        if (!stored) throw e;
        return { data: stored.value, savedAt: stored.savedAt, fromCache: true };
      }
    },
  });
  return { ...q, data: q.data?.data, savedAt: q.data?.savedAt, fromCache: q.data?.fromCache ?? false };
}

/** Mutation with success toast, error toast (unless handled inline) and query invalidation. */
export function useAction<TInput, TOutput = unknown>(
  fn: (input: TInput) => Promise<TOutput>,
  options: { success?: string; invalidate?: QueryKey[]; onSuccess?: (out: TOutput, input: TInput) => void; toastErrors?: boolean } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (out, input) => {
      await Promise.all((options.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (options.success) toast(options.success);
      options.onSuccess?.(out, input);
    },
    onError: (e) => {
      if (options.toastErrors) toast(errorMessage(e), 'error');
    },
  });
}

export function useLang() {
  const { i18n } = useTranslation();
  return (i18n.language === 'ur' ? 'ur' : 'en') as 'en' | 'ur';
}

/** School-authored content: prefer the Urdu variant when reading in Urdu and it exists. */
export function useLocalized() {
  const lang = useLang();
  return (en: string, ur: string | null | undefined) => (lang === 'ur' && ur ? ur : en);
}
