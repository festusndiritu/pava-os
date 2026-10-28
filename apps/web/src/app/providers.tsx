'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider } from '../lib/theme-context';
import { ToastViewport } from '../components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // Stock and prices must stay fresh: cached data is shown instantly but always revalidated.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 0, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true } } }),
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