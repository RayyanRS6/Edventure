'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { searchResults, z } from '@edventure/contracts';
import { api } from '@/lib/api';

export type PickedPerson = { kind: 'student' | 'teacher'; id: string; displayName: string; detail: string };

/** Search-as-you-type picker over `/search` (students and/or teachers). */
export function PersonPicker({
  label,
  kinds = ['student'],
  value,
  onChange,
  required,
}: {
  label: string;
  kinds?: Array<'student' | 'teacher'>;
  value: PickedPerson | null;
  onChange: (p: PickedPerson | null) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<z.infer<typeof searchResults>>('/search', { query: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
  const options: PickedPerson[] = [
    ...(kinds.includes('student') ? (results.data?.students ?? []).map((s) => ({ kind: 'student' as const, id: s.id, displayName: s.displayName, detail: [s.admissionNumber, s.detail].filter(Boolean).join(' · ') })) : []),
    ...(kinds.includes('teacher') ? (results.data?.teachers ?? []).map((s) => ({ kind: 'teacher' as const, id: s.id, displayName: s.displayName, detail: s.employeeNumber })) : []),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink-soft">
        {label}
        {required && <span className="text-danger-fg"> *</span>}
      </label>
      {value ? (
        <div className="flex h-10 items-center justify-between rounded-lg border border-line-strong bg-sunken/50 px-3 text-sm">
          <span className="truncate">
            <span className="font-medium">{value.displayName}</span>
            <span className="ms-2 text-[12px] text-muted">{value.detail}</span>
          </span>
          <button onClick={() => onChange(null)} aria-label={t('common.clear')} className="rounded p-0.5 text-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            id={inputId}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-autocomplete="list"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            placeholder={t('web.common.searchPeople')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && q.trim().length >= 2 && (
            <ul role="listbox" className="absolute inset-x-0 top-11 z-20 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
              {options.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-muted">{results.isFetching ? t('common.loading') : t('common.noResults')}</li>
              ) : (
                options.map((o) => (
                  <li key={`${o.kind}-${o.id}`} role="option" aria-selected={false}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-start hover:bg-sunken"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(o);
                        setQ('');
                        setOpen(false);
                      }}
                    >
                      <span className="text-sm font-medium">{o.displayName}</span>
                      <span className="text-[12px] text-muted">
                        {kinds.length > 1 ? `${t(`web.common.${o.kind}`)} · ` : ''}
                        {o.detail}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
