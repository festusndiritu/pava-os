'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
            backgroundColor: 'var(--color-status-badSoft)',
            color: 'var(--color-status-bad)',
          }}
        >
          <TriangleAlert size={22} strokeWidth={1.8} />
        </div>

        <h1
          className="text-lg font-semibold"
          style={{ color: 'var(--color-ink-900)' }}
        >
          Something went wrong
        </h1>

        <p
          className="mx-auto mt-2 max-w-sm text-sm leading-6"
          style={{ color: 'var(--color-ink-600)' }}
        >
          An unexpected error occurred. You can try again or return to the dashboard.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
            }}
          >
            Try again
          </button>

          <Link
            href="/"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-ink-900)',
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
