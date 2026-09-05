'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { Sidebar } from '../../components/shell/Sidebar';
import { Topbar } from '../../components/shell/Topbar';
import { IdleWarningDialog } from '../../components/shell/IdleWarningDialog';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Nothing renders for a logged-out/loading visitor — the effect above is
  // already sending them to /login. This is a UX-only guard; every real
  // protected request is still enforced server-side regardless.
  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden w-60 shrink-0 border-r lg:block"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <Sidebar />
      </aside>

      {/* Mobile slide-over */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(16, 24, 40, 0.45)' }}
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className="absolute left-0 top-0 h-full w-72 border-r"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: 'var(--color-ink-600)' }}
            >
              <X size={18} strokeWidth={2} />
            </button>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>

      <IdleWarningDialog />
    </div>
  );
}