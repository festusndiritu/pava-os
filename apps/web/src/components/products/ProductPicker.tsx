'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { productsApi, type Product } from '../../lib/products-api';
import { thicknessLabel } from '../../lib/shape-config';

export function ProductPicker({ onSelect, placeholder = 'Search products…' }: { onSelect: (p: Product) => void; placeholder?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      productsApi
        .list({ search: query })
        .then((r) => setResults(r.slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
        />
      </div>

      {open && query.trim().length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-card)' }}
        >
          {loading && (
            <p className="px-3 py-3 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              Searching…
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-3 text-sm" style={{ color: 'var(--color-ink-600)' }}>
              No products match "{query}".
            </p>
          )}
          {!loading &&
            results.map((p) => {
              const gauge = thicknessLabel(p.shape, p.thicknessMm);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setQuery('');
                    setResults([]);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-bg)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                      {p.displayName ?? p.name}
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
                      {p.name}
                      {gauge ? ` · ${gauge}` : ''} · Stock {p.stockQuantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                    KSh {p.basePrice.toLocaleString()}
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}