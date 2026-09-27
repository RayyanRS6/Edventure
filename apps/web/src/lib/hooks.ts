'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AcademicYear, ClassOffering, Stream, Subject, TeacherListItem } from '@edventure/contracts';
import type { Query } from '@edventure/api-client';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from './api';

export function useApi<T>(key: QueryKey, path: string | null, query?: Query, options: { staleTime?: number; refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: [...key, query ?? null],
    queryFn: () => api.get<T>(path!, { query }),
    enabled: path !== null,
    ...options,
  });
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

/* ---------------- Reference data (cached for 10 minutes, per the caching plan) ---------------- */

const REF = { staleTime: 10 * 60_000 };

export function useYears() {
  return useApi<{ items: AcademicYear[] }>(['academic-years'], '/academic-years', undefined, REF);
}

export function useActiveYear() {
  const years = useYears();
  const items = years.data?.items ?? [];
  const active = items.find((y) => y.status === 'active') ?? items.find((y) => y.status === 'planning') ?? items[items.length - 1] ?? null;
  return { ...years, year: active };
}

export function useClasses(academicYearId: string | null | undefined) {
  return useApi<{ items: ClassOffering[] }>(['classes', academicYearId], academicYearId ? '/classes' : null, academicYearId ? { academicYearId } : undefined, REF);
}

export function useSectionOptions(academicYearId: string | null | undefined) {
  const classes = useClasses(academicYearId);
  const options = (classes.data?.items ?? []).flatMap((c) => c.sections.filter((s) => !s.archived).map((s) => ({ value: s.id, label: `${c.gradeName} ${s.name}`, classOfferingId: c.id })));
  return { ...classes, options };
}

export function useSubjects() {
  return useApi<{ items: Subject[] }>(['subjects'], '/subjects', undefined, REF);
}

export function useStreams() {
  return useApi<{ items: Stream[] }>(['streams'], '/streams', undefined, REF);
}

export function useTeacherOptions() {
  const q = useApi<{ items: TeacherListItem[] }>(['teachers', 'options'], '/teachers', { limit: 100, accountStatus: 'active' }, REF);
  return { ...q, options: (q.data?.items ?? []).map((t) => ({ value: t.id, label: `${t.displayName} (${t.employeeNumber})` })) };
}

export function useLang() {
  const { i18n } = useTranslation();
  return (i18n.language === 'ur' ? 'ur' : 'en') as 'en' | 'ur';
}
