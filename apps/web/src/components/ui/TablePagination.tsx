'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtNumber } from '../../lib/format';
import { pageWindow, type PaginationState } from '../../lib/use-data-table';

function PageButton({ children, label, onClick, disabled, current }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; current?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors hover:bg-[var(--color-bg)] disabled:opacity-40 disabled:hover:bg-transparent"
      style={{
        borderColor: current ? 'var(--color-accent)' : 'var(--color-border)',
        backgroundColor: current ? 'var(--color-accent-soft)' : 'transparent',
        color: current ? 'var(--color-accent)' : 'var(--color-ink-900)',
      }}
    >
      {children}
    </button>
  );
}

/** "51–100 of 1,240", a rows-per-page choice, and page buttons. */
export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions }: PaginationState) {
  if (total === 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const showSizes = total > pageSizeOptions[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-sm data-num" aria-live="polite" style={{ color: 'var(--color-ink-600)' }}>
        {fmtNumber(from)}–{fmtNumber(to)} of {fmtNumber(total)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {showSizes && (
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-ink-600)' }}>
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="min-h-9 rounded-md border px-2 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {pageCount > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <PageButton label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft size={15} strokeWidth={2} />
            </PageButton>
            <span className="px-2 text-xs data-num sm:hidden" style={{ color: 'var(--color-ink-600)' }}>
              Page {page} of {pageCount}
            </span>
            <ul className="hidden items-center gap-1 sm:flex">
              {pageWindow(page, pageCount).map((n, i) => (
                <li key={n === 'gap' ? `gap-${i}` : n}>
                  {n === 'gap' ? (
                    <span className="px-1 text-sm" aria-hidden style={{ color: 'var(--color-ink-600)' }}>
                      …
                    </span>
                  ) : (
                    <PageButton label={`Page ${n}`} current={n === page} onClick={() => onPageChange(n)}>
                      {n}
                    </PageButton>
                  )}
                </li>
              ))}
            </ul>
            <PageButton label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
              <ChevronRight size={15} strokeWidth={2} />
            </PageButton>
          </nav>
        )}
      </div>
    </div>
  );
}
