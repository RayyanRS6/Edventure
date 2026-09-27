'use client';

import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { EmptyState } from './states';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  numeric?: boolean;
  /** Keep short values (dates, numbers, codes) on one line. Numeric columns never wrap. */
  nowrap?: boolean;
}

/** Searchable management tables: simple, readable, keyboard reachable rows. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  footer,
}: {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!rows.length) return <>{empty ?? <EmptyState title={t('common.noResults')} />}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-accent-50/65 text-start">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={clsx('px-4 py-3 text-[12px] font-semibold text-ink-soft', c.numeric ? 'text-end' : 'text-start', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              className={clsx('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-accent-50/60 focus:bg-accent-50')}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-4 py-3 align-middle', c.numeric && 'tabular whitespace-nowrap text-end', c.nowrap && 'whitespace-nowrap', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
    </div>
  );
}
