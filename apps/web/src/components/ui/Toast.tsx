'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type Kind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
  action?: { label: string; onClick: () => void };
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<(next: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(items);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: Kind, message: string, action?: ToastItem['action']) {
  const id = nextId++;
  // Same message twice in a row replaces rather than stacks.
  items = [...items.filter((t) => t.message !== message), { id, kind, message, action }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), kind === 'error' || action ? 7000 : 3500);
}

export const toast = {
  success: (message: string, action?: ToastItem['action']) => push('success', message, action),
  error: (message: string) => push('error', message),
};

export function removeWithUndo<T>(list: T[], index: number, label: string, set: (update: (prev: T[]) => T[]) => void) {
  const item = list[index];
  if (item === undefined) return;
  set((prev) => prev.filter((_, i) => i !== index));
  toast.success(`Removed ${label}`, { label: 'Undo', onClick: () => set((prev) => [...prev.slice(0, index), item, ...prev.slice(index)]) });
}

export function ToastViewport() {
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed left-1/2 z-[60] flex w-[min(92vw,24rem)] -translate-x-1/2 flex-col items-stretch gap-2 md:left-auto md:right-4 md:translate-x-0"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className="pava-rise pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)', color: 'var(--color-ink-900)' }}
        >
          {t.kind === 'success' ? (
            <CheckCircle2 size={17} strokeWidth={2} className="mt-px shrink-0" style={{ color: 'var(--color-status-ok)' }} />
          ) : (
            <AlertCircle size={17} strokeWidth={2} className="mt-px shrink-0" style={{ color: 'var(--color-status-bad)' }} />
          )}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
              className="min-h-8 pointer-coarse:min-h-11 shrink-0 rounded px-2 font-semibold"
              style={{ color: 'var(--color-accent)' }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 flex icon-btn shrink-0 items-center justify-center rounded" style={{ color: 'var(--color-ink-600)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
