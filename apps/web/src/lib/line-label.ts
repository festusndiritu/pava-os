import type { Product } from './products-api';

/** How a product reads on paper: its name, plus its brand when the name doesn't already say it. */
export function lineLabel(p: Pick<Product, 'name' | 'displayName' | 'brand'>): string {
  const base = p.displayName ?? p.name;
  const brand = p.brand?.name?.trim();
  if (!brand) return base;
  return base.toLowerCase().includes(brand.toLowerCase()) ? base : `${base} (${brand})`;
}
