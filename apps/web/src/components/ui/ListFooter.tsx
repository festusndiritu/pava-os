'use client';

/** The bottom of a paged list: "Show more", a spinner label, or a retry. */
export function ListFooter({ hasMore, loadingMore, error, onMore, onRetry }: { hasMore: boolean; loadingMore: boolean; error: string | null; onMore: () => void; onRetry: () => void }) {
  if (!hasMore && !error) return null;
  return (
    <div className="flex flex-col items-center gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
          {error}
        </p>
      )}
      {error && !hasMore ? (
        <button type="button" onClick={onRetry} className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>
          Try again
        </button>
      ) : (
        hasMore && (
          <button type="button" onClick={onMore} disabled={loadingMore} className="min-h-10 rounded-md border px-4 text-sm font-medium disabled:opacity-60" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        )
      )}
    </div>
  );
}
