'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { iconFor } from './nav-icons';
import { useNav } from './use-nav';
import type { ModuleKey } from '../../lib/constants';

function activeSectionLabel(sections: ReturnType<typeof useNav>['sections'], isActive: (href: string) => boolean) {
  return sections.find((s) => s.items.some((i) => isActive(i.href)))?.label;
}

function NavItem({ item, active }: { item: { module: ModuleKey; href: string; label: string }; active: boolean }) {
  const Icon = iconFor(item);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'text-[var(--color-ink-600)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink-900)]'
      }`}
    >
      <Icon size={16} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const { sections, isActive, pathname } = useNav();
  const pinnedSections = sections.filter((s) => s.pinned);
  const accordionSections = sections.filter((s) => !s.pinned);

  const [openLabel, setOpenLabel] = useState<string | null>(() => activeSectionLabel(accordionSections, isActive) ?? null);

  useEffect(() => {
    setOpenLabel(activeSectionLabel(accordionSections, isActive) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggle(label: string) {
    setOpenLabel((prev) => (prev === label ? null : label));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Image src="/icons/icon-192.png" alt="Pava Steel" width={28} height={28} className="rounded-md object-contain" priority />
        <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
          Pava OS
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {pinnedSections.map((section) => (
          <div key={section.label} className="mb-3 flex flex-col gap-0.5">
            {/* A single-item pinned section (Overview/Dashboard) doesn't need a header of its own */}
            {section.items.length > 1 && (
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}>
                {section.label}
              </p>
            )}
            {section.items.map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        ))}

        {accordionSections.map((section) => {
          const expanded = openLabel === section.label;
          const panelId = `nav-section-${section.label.replace(/\s+/g, '-').toLowerCase()}`;
          return (
            <div key={section.label} className="mb-1">
              <button
                type="button"
                onClick={() => toggle(section.label)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase transition-colors hover:bg-[var(--color-bg)]"
                style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}
              >
                {section.label}
                <ChevronRight size={13} strokeWidth={2.25} style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }} />
              </button>

              {expanded && (
                <div id={panelId} className="mb-3 mt-0.5 flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <NavItem key={item.href} item={item} active={isActive(item.href)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
