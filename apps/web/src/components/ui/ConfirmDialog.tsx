'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';

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
  tone = 'danger',
  icon: Icon = AlertTriangle,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  icon?: LucideIcon;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const accent = tone === 'danger' ? 'var(--color-status-bad)' : 'var(--color-accent)';
  const accentSoft = tone === 'danger' ? 'var(--color-status-badSoft)' : 'var(--color-accent-soft)';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.5)' }} onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full rounded-t-xl border p-5 sm:max-w-sm sm:rounded-lg"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
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
          <button type="button" onClick={onCancel} className="min-h-11 rounded-md border px-4 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
            Cancel
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
      </div>
    </div>
  );
}