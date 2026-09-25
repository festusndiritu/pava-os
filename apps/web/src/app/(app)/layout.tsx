'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { moduleForPath } from '../../lib/constants';
import { Sidebar } from '../../components/shell/Sidebar';
import { BottomNav } from '../../components/shell/BottomNav';
import { NavSheet } from '../../components/shell/NavSheet';
import { Topbar } from '../../components/shell/Topbar';
import { IdleWarningDialog } from '../../components/shell/IdleWarningDialog';
import { ToastViewport } from '../../components/ui/Toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, hasPermission } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  // POS wants every pixel it can get on a counter screen — the sidebar, rail
  // and tab bar all stay gone there; the topbar (menu, sign out, theme,
  // calculator) is worth keeping.
  const isPos = pathname?.startsWith('/pos');

  // A navigation sheet left open across a route change (back button, a link
  // inside it) would sit over the new page.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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
      {/* Desktop and tablet: full sidebar from `md` up. Phone: bottom tab bar
          (below). Tablet used to get a narrow icon-only rail here — but an
          icon with no label is a worse trade for the width it saves than it
          looks like on paper, and a tablet has the width to spare anyway. */}
      {!isPos && (
        // Pinned to the viewport with its own scroll: the navigation stays put
        // while the page body scrolls, and a long nav scrolls independently.
        <aside
          className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r md:block"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <Sidebar />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setNavOpen(true)} />
        <main className={`flex-1 ${isPos ? '' : 'max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'}`}>
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

      {!isPos && <BottomNav onMore={() => setNavOpen(true)} moreOpen={navOpen} />}
      {navOpen && <NavSheet onClose={() => setNavOpen(false)} />}

      <ToastViewport />
      <IdleWarningDialog />
    </div>
  );
}