'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

/**
 * The one confirm-before-you-act dialog for the whole app. Archiving a
 * product, archiving a customer, discarding something — anything that needs
 * a deliberate second tap uses this instead of a bespoke inline prompt, so
 * the pause feels the same everywhere.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon: Icon = AlertTriangle,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  icon?: LucideIcon;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const accent = tone === 'danger' ? 'var(--color-status-bad)' : 'var(--color-accent)';
  const accentSoft = tone === 'danger' ? 'var(--color-status-badSoft)' : 'var(--color-accent-soft)';

  return (
    <Modal onClose={onCancel} role="alertdialog" label={title} className="p-5 sm:max-w-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: accentSoft, color: accent }}>
          <Icon size={17} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
            {title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end" style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}>
        <button type="button" data-autofocus onClick={onCancel} className="min-h-11 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
