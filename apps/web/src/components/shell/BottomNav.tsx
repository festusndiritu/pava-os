'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import type { ModuleKey } from '../../lib/constants';
import { iconFor } from './nav-icons';
import { useNav } from './use-nav';

// The four destinations most likely to be a one-tap job on a phone. Whatever
// the user isn't permitted to see is skipped and the next one moves up;
// everything else lives behind "More".
const PRIMARY: ModuleKey[] = ['DASHBOARD', 'POS', 'INVOICES', 'PRODUCTS', 'CUSTOMERS', 'INVENTORY'];

/** Phone navigation: a bottom tab bar, reachable with a thumb. Hidden from `md` up. */
export function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { sections, isActive } = useNav();
  const all = sections.flatMap((s) => s.items);
  const primary = PRIMARY.map((m) => all.find((i) => i.module === m)).filter((i): i is (typeof all)[number] => Boolean(i)).slice(0, 4);
  const onPrimary = primary.some((i) => isActive(i.href));

  const tab = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium';

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t md:hidden"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {primary.map((item) => {
        const Icon = iconFor(item);
        const active = isActive(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={tab} style={{ color: active ? 'var(--color-accent)' : 'var(--color-ink-600)' }}>
            <Icon size={20} strokeWidth={active ? 2.25 : 2} />
            {item.label}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} aria-haspopup="dialog" aria-expanded={moreOpen} className={tab} style={{ color: moreOpen || !onPrimary ? 'var(--color-accent)' : 'var(--color-ink-600)' }}>
        <Menu size={20} strokeWidth={2} />
        More
      </button>
    </nav>
  );
}
