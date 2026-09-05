'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { Avatar } from '../components/Avatar';
import { ThemeToggle } from '../components/ThemeToggle';

// PLACEHOLDER: this becomes the real dashboard once the protected app shell
// (sidebar, topbar, permission-aware nav) lands in the next chunk. For now
// it only exists to prove the login → redirect → authenticated fetch loop
// actually works end to end.
export default function DashboardPlaceholder() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div
        className="w-full max-w-sm rounded-lg border p-8 text-center"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex justify-center">
          <Avatar name={user.name} avatar={user.avatar} size={56} />
        </div>
        <p className="mt-4 font-medium" style={{ color: 'var(--color-ink-900)' }}>
          Signed in as {user.name}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Role: {user.role}
          {user.role === 'STAFF' && user.permissions.length > 0 ? ` · ${user.permissions.length} module(s)` : ''}
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-6 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
        >
          <LogOut size={15} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </main>
  );
}