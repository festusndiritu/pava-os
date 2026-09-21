import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { THEME_BOOT_SCRIPT } from '../lib/theme-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-custom', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: "Pava OS",
  description: 'Internal quotes, invoices, receipts and stock reference',
};

// Tints the mobile browser chrome (and the PWA splash screen background)
// with the brand accent rather than leaving it to the browser default.
export const viewport: Viewport = {
  themeColor: '#0559C9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before paint so there's no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}