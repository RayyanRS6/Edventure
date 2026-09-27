'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import clsx from 'clsx';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { forwardRef, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

const control =
  'w-full rounded-xl border border-line-strong bg-surface px-4 text-sm text-ink placeholder:text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100 disabled:bg-sunken aria-[invalid=true]:border-danger-fg';

export function Field({ label, hint, error, required, children, className }: { label: string; hint?: string; error?: string; required?: boolean; children: (id: string, describedBy?: string) => ReactNode; className?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
        {required && <span className="text-danger-fg"> *</span>}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx(control, 'h-11', className)} {...rest} />;
});

const EMPTY_VALUE = '__edventure_empty_option__';

/** Themed single-select. The menu is portaled into a native dialog when used inside one. */
export function Select({
  value,
  onValue,
  options,
  placeholder,
  disabled,
  required,
  invalid,
  id,
  describedBy,
  ariaLabel,
  compact,
  className,
}: {
  value: string;
  onValue: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  id?: string;
  describedBy?: string;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement>();
  const emptyOption = options.find((option) => option.value === '');
  const emptyLabel = emptyOption?.label ?? placeholder ?? t('web.common.select');
  const items = placeholder !== undefined || emptyOption || value === ''
    ? [{ value: EMPTY_VALUE, label: emptyLabel }, ...options.filter((option) => option.value !== '')]
    : options;

  return (
    <SelectPrimitive.Root
      dir={i18n.language === 'ur' ? 'rtl' : 'ltr'}
      value={value === '' ? EMPTY_VALUE : value}
      onValueChange={(next) => onValue(next === EMPTY_VALUE ? '' : next)}
      onOpenChange={(open) => {
        if (open) setPortalContainer(triggerRef.current?.closest('dialog') ?? document.body);
      }}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        ref={triggerRef}
        id={id}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={clsx(
          'group flex w-full min-w-0 items-center justify-between gap-3 border border-line-strong bg-surface text-start text-ink outline-none transition-colors hover:border-accent-500 focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-100 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted aria-[invalid=true]:border-danger-fg',
          compact ? 'h-9 rounded-lg px-3 text-[13px]' : 'h-11 rounded-xl px-4 text-sm',
          value === '' && 'text-subtle',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate"><SelectPrimitive.Value placeholder={emptyLabel} /></span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} className="shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={portalContainer}>
        <SelectPrimitive.Content
          position="popper"
          align="start"
          sideOffset={6}
          className="z-[100] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[0_18px_48px_rgba(32,32,48,0.14)]"
          style={{ width: 'var(--radix-select-trigger-width)' }}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-muted"><ChevronUp size={15} /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="max-h-[min(19rem,var(--radix-select-content-available-height))] overflow-y-auto p-1">
            {items.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-9 cursor-pointer items-center rounded-lg py-1.5 ps-3 pe-8 text-sm text-ink outline-none data-[highlighted]:bg-accent-50 data-[highlighted]:text-accent-800 data-[state=checked]:font-semibold"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute end-2 text-accent-700"><Check size={15} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-muted"><ChevronDown size={15} /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx(control, 'min-h-24 py-2', className)} {...rest} />;
});

/** Labelled input in one line; `onValue` receives the string value. */
export function TextField({
  label,
  value,
  onValue,
  error,
  hint,
  required,
  type = 'text',
  dir,
  placeholder,
  autoComplete,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          invalid={!!error}
          type={type}
          dir={dir}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          onChange={(e) => onValue(e.target.value)}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onValue,
  options,
  error,
  required,
  placeholder,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} error={error} required={required} className={className}>
      {(id, describedBy) => (
        <Select id={id} describedBy={describedBy} invalid={!!error} value={value} onValue={onValue} options={options} placeholder={placeholder} disabled={disabled} required={required} />
      )}
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-accent-600" />
      <label htmlFor={id} className="text-sm">
        {label}
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </label>
    </div>
  );
}
