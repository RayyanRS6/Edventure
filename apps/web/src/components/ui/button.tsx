'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './states';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const styles: Record<Variant, string> = {
  primary: 'bg-brand-night text-white hover:bg-accent-700 disabled:bg-accent-200',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-sunken disabled:text-subtle',
  ghost: 'text-ink-soft hover:bg-sunken disabled:text-subtle',
  danger: 'bg-danger-fg text-white hover:brightness-110 disabled:opacity-50',
};
const sizes: Record<Size, string> = { sm: 'h-9 px-4 text-[13px] gap-1.5', md: 'h-11 px-5 text-sm gap-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed',
        styles[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({ href, variant = 'secondary', size = 'md', icon, children, className }: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors', styles[variant], sizes[size], className)}>
      {icon}
      {children}
    </Link>
  );
}
