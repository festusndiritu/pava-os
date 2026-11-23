/**
 * The text printed for a product on a quote, invoice or receipt. When the product has a brand that
 * isn't already part of its name, the brand is added — "D8 Welding Rod (Kifaru)" — so two brands of
 * the same item can be told apart on paper.
 */
export function lineLabel(p: { name: string; displayName: string | null; brand?: { name: string } | null }): string {
  const base = p.displayName ?? p.name;
  const brand = p.brand?.name?.trim();
  if (!brand) return base;
  return base.toLowerCase().includes(brand.toLowerCase()) ? base : `${base} (${brand})`;
}
