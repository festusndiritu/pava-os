'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider } from '../lib/theme-context';
import { ToastViewport } from '../components/ui/Toast';

// Registered on every load (not only when push is turned on) so the app can open with no internet.
function useRegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Stock and prices must stay fresh: cached data is shown instantly but always revalidated. networkMode 'always'
  // lets queries run (and fall back to the copy kept on the device) when the browser reports offline, instead of pausing.
  useRegisterServiceWorker();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 0, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'always' }, mutations: { networkMode: 'always' } } }),
  );
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <ToastViewport />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}