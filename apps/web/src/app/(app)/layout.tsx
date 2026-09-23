'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LockKeyhole, X } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { moduleForPath } from '../../lib/constants';
import { Sidebar } from '../../components/shell/Sidebar';
import { Topbar } from '../../components/shell/Topbar';
import { IdleWarningDialog } from '../../components/shell/IdleWarningDialog';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, hasPermission } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // POS wants every pixel it can get on a counter screen — the sidebar
  // stays gone there; topbar (sign out, theme, calculator) is worth keeping.
  const isPos = pathname?.startsWith('/pos');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Nothing renders for a logged-out/loading visitor — the effect above is
  // already sending them to /login. This is a UX-only guard; every real
  // protected request is still enforced server-side regardless.
  if (loading || !user) return null;

  // The sidebar only ever links to what hasPermission() allows, but a typed
  // URL, a stale bookmark, or the browser's back/forward can still land the
  // user on a page their nav never showed them. Block the page itself here,
  // once, for every module-gated route — rather than relying on each page
  // to duplicate this check (most don't) or on every backend read endpoint
  // happening to be permission-gated (some legitimately aren't, e.g. ones
  // shared across modules). Routes with no module (e.g. /profile) pass through.
  const requiredModule = moduleForPath(pathname ?? '');
  const allowed = !requiredModule || hasPermission(requiredModule);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Desktop sidebar */}
      {!isPos && (
        // Pinned to the viewport with its own scroll: the navigation stays put
        // while the page body scrolls, and a long nav scrolls independently.
        <aside
          className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r lg:block"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <Sidebar />
        </aside>
      )}

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
        <main className="flex-1">
          {allowed ? (
            children
          ) : (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-6">
              <div
                className="w-full max-w-md rounded-xl border p-8 text-center"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'var(--color-status-warnSoft)',
                    color: 'var(--color-status-warn)',
                  }}
                >
                  <LockKeyhole size={22} strokeWidth={1.8} />
                </div>

                <h1
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-ink-900)' }}
                >
                  Access restricted
                </h1>

                <p
                  className="mx-auto mt-2 max-w-sm text-sm leading-6"
                  style={{ color: 'var(--color-ink-600)' }}
                >
                  You don't have permission to view this module.
                </p>

                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="mt-6 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: '#FFFFFF',
                  }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <IdleWarningDialog />
    </div>
  );
}