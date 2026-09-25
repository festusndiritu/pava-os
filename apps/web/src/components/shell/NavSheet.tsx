'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { iconFor } from './nav-icons';
import { useNav } from './use-nav';

/**
 * Every destination the user can reach, as a bottom sheet. It's the "More"
 * tab on phones and the menu button inside the POS (where the sidebar and
 * tab bar are deliberately gone to give the till the whole screen).
 */
export function NavSheet({ onClose }: { onClose: () => void }) {
  const { sections, isActive } = useNav();

  return (
    <Modal onClose={onClose} label="Menu" className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-md">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          Menu
        </h2>
        <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <nav aria-label="All modules" className="overflow-y-auto px-3 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {sections.map((section) => (
          <div key={section.label} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
              {section.label}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {section.items.map((item) => {
                const Icon = iconFor(item);
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors ${
                      active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-[var(--color-bg)] text-[var(--color-ink-900)] hover:bg-[var(--color-accent-soft)]'
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </Modal>
  );
}
