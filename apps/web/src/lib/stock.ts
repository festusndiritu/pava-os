'use client';

import { useEffect, useState } from 'react';
import { settingsApi } from './settings-api';
import type { Product } from './products-api';

export type StockLevel = 'out' | 'low' | 'in';

/** Out at zero or below, low at or under the shop's threshold, otherwise in stock. */
export function stockLevel(quantity: number, threshold: number): StockLevel {
  if (quantity <= 0) return 'out';
  if (quantity <= threshold) return 'low';
  return 'in';
}

export const LEVEL_TONE: Record<StockLevel | 'supplier', { label: string; bg: string; fg: string }> = {
  in: { label: 'In stock', bg: 'var(--color-status-okSoft)', fg: 'var(--color-status-ok)' },
  low: { label: 'Low stock', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
  out: { label: 'Out of stock', bg: 'var(--color-status-badSoft)', fg: 'var(--color-status-bad)' },
  supplier: { label: 'Supplier only', bg: 'var(--color-status-warnSoft)', fg: 'var(--color-status-warn)' },
};

/**
 * What to tell the person about a product's availability. `stockStatus` is a
 * note someone typed into the product form; nothing updates it when stock
 * moves, so on its own it happily says "In stock" at zero units. The quantity
 * on the shelf is the truth: only the two manual flags that say something the
 * count can't (supplier-only, explicitly out) override it.
 */
export function availability(p: Pick<Product, 'stockStatus' | 'stockQuantity'>, threshold: number): StockLevel | 'supplier' {
  if (p.stockStatus === 'SUPPLIER_ONLY') return 'supplier';
  if (p.stockStatus === 'OUT_OF_STOCK') return 'out';
  return stockLevel(p.stockQuantity, threshold);
}

/** The shop's low-stock threshold, or null until it has loaded (or if it can't be read). */
export function useLowStockThreshold(): number | null {
  const [threshold, setThreshold] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    settingsApi
      .get()
      .then((s) => live && setThreshold(s.lowStockThreshold))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return threshold;
}
