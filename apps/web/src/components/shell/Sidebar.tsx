'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { iconFor } from './nav-icons';
import { useNav } from './use-nav';

// A true accordion: opening a section closes whichever one was open before,
// so headers stay a short, scannable list instead of stacking up as you
// explore. The section holding the current page is what's open by default —
// there's no separate "remembered" state to fight with that, since navigating
// anywhere always makes that page's section the sensible one to show.
function activeSectionLabel(sections: ReturnType<typeof useNav>['sections'], isActive: (href: string) => boolean) {
  return sections.find((s) => s.items.some((i) => isActive(i.href)))?.label;
}

export function Sidebar() {
  const { sections, isActive, pathname } = useNav();
  const [openLabel, setOpenLabel] = useState<string | null>(() => activeSectionLabel(sections, isActive) ?? null);

  // Whatever section you navigate into — via the sidebar, a link elsewhere in
  // the app, or the browser's back/forward — becomes the one that's open,
  // closing whatever was open before.
  useEffect(() => {
    setOpenLabel(activeSectionLabel(sections, isActive) ?? null);
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
        {sections.map((section) => {
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
                  {section.items.map((item) => {
                    const Icon = iconFor(item);
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
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
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
