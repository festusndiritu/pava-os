'use client';

import { AuthProvider } from '../lib/auth-context';
import { ThemeProvider } from '../lib/theme-context';
import { ToastViewport } from '../components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <ToastViewport />
      </AuthProvider>
    </ThemeProvider>
  );
}