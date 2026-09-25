'use client';

import Image from 'next/image';
import Link from 'next/link';
import { iconFor } from './nav-icons';
import { useNav } from './use-nav';

/**
 * The tablet navigation: a narrow icon rail that's always there, instead of a
 * hamburger that hides the whole menu behind a tap. Labels come from the
 * tooltip and the accessible name; the full sidebar takes over at `lg`.
 */
export function SidebarRail() {
  const { sections, isActive } = useNav();

  return (
    <div className="flex h-full flex-col items-center">
      <div className="py-4">
        <Image src="/icons/icon-192.png" alt="Pava Steel" width={28} height={28} className="rounded-md object-contain" priority />
      </div>

      <nav aria-label="Main" className="flex w-full flex-1 flex-col gap-3 overflow-y-auto px-2 pb-4">
        {sections.map((section, i) => (
          <div key={section.label} className="flex flex-col gap-0.5" style={i > 0 ? { borderTop: '1px solid var(--color-border)', paddingTop: 12 } : undefined}>
            {section.items.map((item) => {
              const Icon = iconFor(item);
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-10 w-full items-center justify-center rounded-md transition-colors ${
                    active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-ink-600)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink-900)]'
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
