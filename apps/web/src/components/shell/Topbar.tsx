'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronDown, LogOut, Menu, ShoppingCart, User as UserIcon, UsersRound } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { Avatar } from '../Avatar';
import { ThemeToggle } from '../ThemeToggle';
import { QuickCalculator } from './QuickCalculator';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const today = useTodayLabel();

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (!user) return null;

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded-md lg:hidden"
          style={{ color: 'var(--color-ink-600)' }}
        >
          <Menu size={19} strokeWidth={2} />
        </button>

        <div className="hidden items-center gap-1.5 text-sm sm:flex" style={{ color: 'var(--color-ink-600)' }}>
          <CalendarDays size={15} strokeWidth={2} />
          {today}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {hasPermission('POS') && (
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
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
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
              {user.role === 'ADMIN' && (
                <Link
                  href="/users"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--color-ink-900)' }}
                >
                  <UsersRound size={15} strokeWidth={2} />
                  Users &amp; Access
                </Link>
              )}
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
    </header>
  );
}