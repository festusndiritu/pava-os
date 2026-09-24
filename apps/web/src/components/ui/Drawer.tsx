'use client';

import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useOverlay } from './Modal';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
  guardUnsaved,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /**
   * For form drawers: once the person has typed or clicked inside, closing
   * with Escape, the X or a tap on the backdrop asks before discarding. A
   * successful save calls onClose directly and is never interrupted.
   */
  guardUnsaved?: boolean;
}) {
  if (!open) return null;
  return (
    <DrawerPanel onClose={onClose} title={title} subtitle={subtitle} footer={footer} wide={wide} guardUnsaved={guardUnsaved}>
      {children}
    </DrawerPanel>
  );
}

function DrawerPanel({
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
  guardUnsaved,
}: Omit<Parameters<typeof Drawer>[0], 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function requestClose() {
    if (guardUnsaved && touched) setConfirming(true);
    else onClose();
  }

  useOverlay(panelRef, requestClose);

  return (
    <>
      <div className="fixed inset-0 z-40">
        <div aria-hidden="true" className="pava-fade-in absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.45)' }} onClick={requestClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`pava-slide-in-right absolute right-0 top-0 flex h-full w-full flex-col border-l outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h2 id={titleId} className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ color: 'var(--color-ink-600)' }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto px-5 py-5"
            onInput={guardUnsaved ? () => setTouched(true) : undefined}
            onClick={guardUnsaved ? (e) => { if ((e.target as HTMLElement).closest('button')) setTouched(true); } : undefined}
          >
            {children}
          </div>

          {footer && (
            <div className="border-t px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
              {footer}
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Discard your changes?"
          description="What you've entered here hasn't been saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setConfirming(false)}
          onConfirm={onClose}
        />
      )}
    </>
  );
}
