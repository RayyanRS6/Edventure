'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { InlineError } from './states';

/** Native <dialog> gives focus trapping, Escape to close and an inert background for free. */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} aria-label={t('common.close')} className="rounded-md p-1 text-muted hover:bg-sunken">
              <X size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/**
 * Two-step deletion (brief requirement): the first confirmation asks if the user is sure; the
 * second shows exactly when recovery ends and what will be affected before anything is deleted.
 */
export function TwoStepDeleteDialog({
  open,
  onClose,
  subject,
  loadPreview,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  subject: string;
  loadPreview: () => Promise<{ recoverUntil: string; impacts: string[] }>;
  onConfirm: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [preview, setPreview] = useState<{ recoverUntil: string; impacts: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPreview(null);
      setError(null);
    }
  }, [open]);
  const next = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await loadPreview());
      setStep(2);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const until = preview ? new Date(preview.recoverUntil).toLocaleString(i18n.language === 'ur' ? 'ur-PK' : 'en-PK', { dateStyle: 'long', timeStyle: 'short' }) : '';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === 1 ? t('web.delete.title', { name: subject }) : t('web.delete.finalTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {step === 1 ? (
            <Button variant="danger" loading={busy} onClick={next}>
              {t('web.delete.yes')}
            </Button>
          ) : (
            <Button variant="danger" loading={busy} onClick={confirm}>
              {t('web.delete.confirm')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {step === 1 ? (
          <p>{t('web.delete.question', { name: subject })}</p>
        ) : (
          <>
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-warning-fg">{t('web.delete.recoverable', { date: until })}</p>
            <ul className="list-disc space-y-1 ps-5 text-ink-soft">
              {preview?.impacts.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </>
        )}
        <InlineError error={error} />
      </div>
    </Dialog>
  );
}
