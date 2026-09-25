'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, ChevronDown, LogOut, Menu, Search, ShoppingCart, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { Avatar } from '../Avatar';
import { ThemeToggle } from '../ThemeToggle';
import { QuickCalculator } from './QuickCalculator';
import { GlobalSearch } from './GlobalSearch';

function useTodayLabel() {
  const format = () => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  const [label, setLabel] = useState(format);

  useEffect(() => {
    // Cheap correctness check for date rollover — a topbar clock isn't
    // worth a per-second re-render, but the date should still update
    // without requiring a full page reload.
    const id = setInterval(() => setLabel(format()), 60_000);
    return () => clearInterval(id);
  }, []);

  return label;
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, hasPermission, logout } = useAuth();
  const pathname = usePathname();
  const isPos = pathname?.startsWith('/pos') ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const today = useTodayLabel();

  // Cmd/Ctrl+K opens the search from anywhere — off inside POS, where it'd
  // compete with the till's own product search and risk navigating away from
  // an unsaved sale.
  useEffect(() => {
    if (isPos) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPos]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!user) return null;

  return (
    <header
      data-app-topbar
      className="sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3">
        {/* Inside the POS the sidebar, rail and tab bar are all gone, so this is
            the way to anywhere else. Everywhere else, navigation is on screen. */}
        {isPos && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ color: 'var(--color-ink-600)' }}
          >
            <Menu size={19} strokeWidth={2} />
          </button>
        )}

        {/* Phones have no sidebar to carry the brand. */}
        {!isPos && (
          <div className="flex items-center gap-2 md:hidden">
            <Image src="/icons/icon-192.png" alt="" width={24} height={24} className="rounded-md object-contain" />
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
              Pava OS
            </span>
          </div>
        )}

        <div className="hidden items-center gap-1.5 text-sm md:flex" style={{ color: 'var(--color-ink-600)' }}>
          <CalendarDays size={15} strokeWidth={2} />
          {today}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {!isPos && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            title="Search (Ctrl/Cmd+K)"
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg)]"
            style={{ color: 'var(--color-ink-600)' }}
          >
            <Search size={17} strokeWidth={2} />
          </button>
        )}

        {hasPermission('POS') && !isPos && (
          <Link
            href="/pos"
            className="mr-1 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
          >
            <ShoppingCart size={15} strokeWidth={2} />
            <span className="hidden sm:inline">POS</span>
          </Link>
        )}

        <QuickCalculator />
        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors"
            style={{ backgroundColor: menuOpen ? 'var(--color-bg)' : 'transparent' }}
          >
            <Avatar name={user.name} avatar={user.avatar} size={28} />
            <span className="hidden text-sm font-medium sm:inline" style={{ color: 'var(--color-ink-900)' }}>
              {user.name}
            </span>
            <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--color-ink-600)' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-md border py-1"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-ink-900)' }}
              >
                <UserIcon size={15} strokeWidth={2} />
                Profile
              </Link>
              <div className="my-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
              <button
                type="button"
                onClick={() => logout()}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
                style={{ color: 'var(--color-status-bad)' }}
              >
                <LogOut size={15} strokeWidth={2} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </header>
  );
}