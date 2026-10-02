'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { Avatar } from '../Avatar';
import { ThemeToggle } from '../ThemeToggle';
import { QuickCalculator } from './QuickCalculator';
import { GlobalSearch } from './GlobalSearch';

function useTodayLabel() {
  const format = () =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date());

  const [label, setLabel] = useState(format);

  useEffect(() => {
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

  // Cmd/Ctrl+K opens global search everywhere except POS.
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

  // Close account menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
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
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left side */}
      <div className="flex min-w-0 items-center gap-3">
        {isPos && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg)]"
            style={{ color: 'var(--color-ink-600)' }}
          >
            <Menu size={19} strokeWidth={2} />
          </button>
        )}

        {/* Mobile brand */}
        {!isPos && (
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={24}
              height={24}
              className="rounded-md object-contain"
            />
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--color-ink-900)' }}
            >
              Pava OS
            </span>
          </div>
        )}

        {/* Date */}
        <div
          className="hidden items-center gap-1.5 text-sm md:flex"
          style={{ color: 'var(--color-ink-600)' }}
        >
          <CalendarDays size={15} strokeWidth={2} />
          {today}
        </div>
      </div>

      {/* Right side */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Desktop global search */}
        {!isPos && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            title="Search (Ctrl/Cmd+K)"
            className="hidden h-9 w-64 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors hover:bg-[var(--color-bg)] lg:flex"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink-500)',
            }}
          >
            <Search size={16} strokeWidth={2} className="shrink-0" />

            <span className="flex-1 truncate">Search anything...</span>

            <kbd
              className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-ink-500)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Compact search on smaller screens */}
        {!isPos && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            title="Search (Ctrl/Cmd+K)"
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg)] lg:hidden"
            style={{ color: 'var(--color-ink-600)' }}
          >
            <Search size={17} strokeWidth={2} />
          </button>
        )}

        {/* POS */}
        {hasPermission('POS') && !isPos && (
          <Link
            href="/pos"
            className="mr-1 flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--color-accent)';
            }}
          >
            <ShoppingCart size={15} strokeWidth={2} />
            <span className="hidden sm:inline">POS</span>
          </Link>
        )}

        <QuickCalculator />

        {/* Account */}
        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-9 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-[var(--color-bg)]"
            style={{
              backgroundColor: menuOpen
                ? 'var(--color-bg)'
                : 'transparent',
            }}
          >
            <Avatar name={user.name} avatar={user.avatar} size={28} />

            <span
              className="hidden max-w-32 truncate text-sm font-medium sm:inline"
              style={{ color: 'var(--color-ink-900)' }}
            >
              {user.name}
            </span>

            <ChevronDown
              size={14}
              strokeWidth={2}
              style={{ color: 'var(--color-ink-600)' }}
            />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border py-1"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* User identity */}
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <Avatar name={user.name} avatar={user.avatar} size={32} />

                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-medium"
                    style={{ color: 'var(--color-ink-900)' }}
                  >
                    {user.name}
                  </div>
                </div>
              </div>

              <div
                className="my-1 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              />

              {/* Profile */}
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--color-bg)]"
                style={{ color: 'var(--color-ink-900)' }}
              >
                <UserIcon size={15} strokeWidth={2} />
                Profile
              </Link>

              {/* Appearance */}
              <div className="flex items-center justify-between px-3 py-2">
                <span
                  className="text-sm"
                  style={{ color: 'var(--color-ink-900)' }}
                >
                  Appearance
                </span>

                <ThemeToggle />
              </div>

              <div
                className="my-1 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              />

              {/* Sign out */}
              <button
                type="button"
                onClick={() => logout()}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg)]"
                style={{ color: 'var(--color-status-bad)' }}
              >
                <LogOut size={15} strokeWidth={2} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && (
        <GlobalSearch onClose={() => setSearchOpen(false)} />
      )}
    </header>
  );
}