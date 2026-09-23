import Link from 'next/link';
import { CircleOff } from 'lucide-react';

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
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
            backgroundColor: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
          }}
        >
          <CircleOff size={22} strokeWidth={1.8} />
        </div>

        <p
          className="text-3xl font-semibold tracking-tight"
          style={{ color: 'var(--color-ink-900)' }}
        >
          404
        </p>

        <h1
          className="mt-1 text-lg font-semibold"
          style={{ color: 'var(--color-ink-900)' }}
        >
          Page not found
        </h1>

        <p
          className="mx-auto mt-2 max-w-sm text-sm leading-6"
          style={{ color: 'var(--color-ink-600)' }}
        >
          The page you're looking for doesn't exist or may have moved.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#FFFFFF',
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
