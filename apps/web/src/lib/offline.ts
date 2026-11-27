'use client';

import { useEffect, useState } from 'react';
import { kvGet, kvSet } from './offline-db';
import { productsApi, type Category, type Product } from './products-api';
import { settingsApi, type BusinessSettings } from './settings-api';

/** True for "couldn't reach the server" (no connection, DNS, a request that timed out), as opposed to the server answering with an error. */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch() rejects with TypeError when there is no connection
  return err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

/** Whether the browser thinks it is online. A true here still doesn't promise the server is reachable. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

// ---------------------------------------------------------------------------------------------
// The catalogue kept on the device, so prices can be looked up and sales rung up with no internet.
// ---------------------------------------------------------------------------------------------

export interface CatalogueSnapshot {
  savedAt: number;
  products: Product[];
  categories: Category[];
  settings: BusinessSettings | null;
}

const CATALOGUE_KEY = 'catalogue';
const MIN_REFRESH_MS = 5 * 60_000;
let refreshing: Promise<void> | null = null;

export const loadCatalogue = () => kvGet<CatalogueSnapshot>(CATALOGUE_KEY).catch(() => undefined);

/** Reads every active product (in pages) and keeps a copy on the device. Cost prices are never stored. */
export function refreshCatalogue(force = false): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const existing = await loadCatalogue();
      if (!force && existing && Date.now() - existing.savedAt < MIN_REFRESH_MS) return;

      const products: Product[] = [];
      for (let offset = 0; offset < 20_000; offset += 200) {
        const page = await productsApi.list({ limit: 200, offset });
        products.push(...page);
        if (page.length < 200) break;
      }
      const [categories, settings] = await Promise.all([
        productsApi.categories().catch(() => existing?.categories ?? []),
        settingsApi.get().catch(() => existing?.settings ?? null),
      ]);
      await kvSet(CATALOGUE_KEY, {
        savedAt: Date.now(),
        products: products.filter((p) => p.active).map((p) => ({ ...p, lastCost: null })),
        categories,
        settings,
      } satisfies CatalogueSnapshot);
      window.dispatchEvent(new Event('pava:catalogue-changed'));
    } catch {
      // Offline or the server is busy: keep whatever copy we already have.
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** After an offline sale, take the units off the copy on the device so the next offline sale sees the lower count. */
export async function applySaleToCatalogue(lines: { productId: string; qty: number }[]): Promise<void> {
  const snap = await loadCatalogue();
  if (!snap) return;
  const sold = new Map<string, number>();
  for (const l of lines) sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.qty);
  await kvSet(CATALOGUE_KEY, { ...snap, products: snap.products.map((p) => (sold.has(p.id) ? { ...p, stockQuantity: p.stockQuantity - sold.get(p.id)! } : p)) });
  window.dispatchEvent(new Event('pava:catalogue-changed'));
}

function haystack(p: Product): string {
  return [p.name, p.displayName, p.spec, p.brand?.name, p.category?.name, p.nominalSize, p.material, p.family?.name, ...(p.aliases ?? []).map((a) => (a as { alias?: string; name?: string }).alias ?? (a as { name?: string }).name)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** The same kind of search the server does, run against the copy on the device. Every word typed has to match. */
export function searchCatalogue(products: Product[], params: { search?: string; categoryId?: string; limit?: number }): Product[] {
  const words = (params.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const rows = products
    .filter((p) => !params.categoryId || p.categoryId === params.categoryId)
    .filter((p) => {
      if (words.length === 0) return true;
      const h = haystack(p);
      return words.every((w) => h.includes(w));
    })
    .sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
  return params.limit ? rows.slice(0, params.limit) : rows;
}

/** Live from the server when reachable; otherwise from the copy on the device. */
export async function listProducts(params: { search?: string; categoryId?: string; limit?: number }): Promise<Product[]> {
  try {
    return await productsApi.list(params);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const snap = await loadCatalogue();
    if (!snap) throw err;
    return searchCatalogue(snap.products, params);
  }
}

export async function listCategories(): Promise<Category[]> {
  try {
    return await productsApi.categories();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const snap = await loadCatalogue();
    if (!snap) throw err;
    return snap.categories;
  }
}

export async function loadSettings(): Promise<BusinessSettings | null> {
  try {
    return await settingsApi.get();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return (await loadCatalogue())?.settings ?? null;
  }
}
