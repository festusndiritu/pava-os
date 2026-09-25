'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

/**
 * Transient confirmations: "Product saved", "Payment recorded". Most saves
 * used to close their drawer and say nothing, which reads as "did that work?".
 *
 * Call `toast.success(...)` / `toast.error(...)` from anywhere — components,
 * handlers, plain modules. <ToastViewport /> is mounted once in the app
 * layout and renders whatever has been pushed.
 */

type Kind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
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

function push(kind: Kind, message: string) {
  const id = nextId++;
  // Same message twice in a row replaces rather than stacks.
  items = [...items.filter((t) => t.message !== message), { id, kind, message }].slice(-3);
  emit();
  // Errors stay longer — there's something to read and possibly act on.
  setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
};

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
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ color: 'var(--color-ink-600)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
