'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Megaphone, Printer } from 'lucide-react';
import { productsApi, type Product } from '../../../lib/products-api';
import { thicknessLabel } from '../../../lib/shape-config';

export default function MarketingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState('PAVA STEEL HARDWARE');

  useEffect(() => {
    productsApi.list().then((p) => setProducts(p.filter((x) => x.active)));
  }, []);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category?.name ?? 'Uncategorised';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(p);
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCategory(items: Product[]) {
    const allOn = items.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  const selectedProducts = products.filter((p) => selected.has(p.id));

  const textBlock = useMemo(() => {
    if (selectedProducts.length === 0) return '';
    const byCategory = new Map<string, Product[]>();
    for (const p of selectedProducts) {
      const key = p.category?.name ?? 'Other';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(p);
    }
    const lines = [title.toUpperCase(), ''];
    for (const [category, items] of byCategory) {
      lines.push(category.toUpperCase());
      for (const p of items) {
        const gauge = thicknessLabel(p.shape, p.thicknessMm);
        const label = [p.displayName ?? p.name, [p.nominalSize, gauge].filter(Boolean).join(' ')].filter(Boolean).join(' — ');
        lines.push(`${label}    KSh ${p.basePrice.toLocaleString()}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }, [selectedProducts, title]);

  function copyText() {
    navigator.clipboard.writeText(textBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Marketing
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Build a customer-friendly pricelist — display names only, no technical jargon.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-4 w-full rounded-md border px-3 py-2 text-sm font-medium outline-none focus:border-[var(--color-accent)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
          />
          <div className="flex flex-col gap-4">
            {grouped.map(([category, items]) => {
              const allOn = items.every((p) => selected.has(p.id));
              return (
                <div key={category} className="rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>{category}</p>
                    <button type="button" onClick={() => toggleCategory(items)} className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3">
                    {items.map((p) => {
                      const gauge = thicknessLabel(p.shape, p.thicknessMm);
                      return (
                        <label key={p.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-bg)]">
                          <span className="flex items-center gap-2">
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                            <span style={{ color: 'var(--color-ink-900)' }}>
                              {p.displayName ?? p.name}
                              {gauge ? <span style={{ color: 'var(--color-ink-600)' }}> · {gauge}</span> : null}
                            </span>
                          </span>
                          <span className="data-num shrink-0" style={{ color: 'var(--color-ink-600)' }}>KSh {p.basePrice.toLocaleString()}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="sticky top-4 rounded-lg border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>Preview</h2>
              <div className="flex gap-2">
                <button type="button" onClick={copyText} disabled={!textBlock} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                  <Copy size={13} strokeWidth={2} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={() => window.print()} disabled={!textBlock} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: 'var(--color-accent)' }}>
                  <Printer size={13} strokeWidth={2} />
                  Print
                </button>
              </div>
            </div>
            {textBlock ? (
              <pre className="whitespace-pre-wrap rounded-md p-4 font-mono text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}>
                {textBlock}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Megaphone size={28} strokeWidth={1.5} className="mb-2" style={{ color: 'var(--color-ink-600)' }} />
                <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>Select products on the left to build a shareable pricelist.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}