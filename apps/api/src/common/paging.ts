/**
 * Optional `limit` / `offset` query params for list endpoints. No limit means
 * "everything", which is what reports and exports need; the list screens ask
 * for a page at a time. Capped so nobody can request the whole table at once
 * by accident, and junk values (negative, NaN) are ignored, not errors.
 */
export const MAX_PAGE_SIZE = 200;

export function parsePaging(limit?: string, offset?: string): { limit?: number; offset?: number } {
  const l = Number.parseInt(limit ?? '', 10);
  const o = Number.parseInt(offset ?? '', 10);
  return {
    limit: Number.isFinite(l) && l > 0 ? Math.min(l, MAX_PAGE_SIZE) : undefined,
    offset: Number.isFinite(o) && o > 0 ? o : undefined,
  };
}
