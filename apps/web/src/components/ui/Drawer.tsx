'use client';

import { X } from 'lucide-react';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16, 24, 40, 0.45)' }} onClick={onClose} />
      <div
        className={`absolute right-0 top-0 flex h-full w-full flex-col border-l ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
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
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ color: 'var(--color-ink-600)' }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="border-t px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}