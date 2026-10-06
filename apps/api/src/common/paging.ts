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

/**
 * `sort=field:dir` from a table header. Only the shape is checked here; each
 * service maps `field` through its own whitelist, so an unknown field (or a
 * hand-edited URL) falls back to that list's default order instead of
 * reaching the database.
 */
export type SortDir = 'asc' | 'desc';

/** Prisma ordering for a nullable column: empty values go last whichever way it sorts. */
export const nullsLast = (dir: SortDir) => ({ sort: dir, nulls: 'last' as const });

export function parseSort(raw?: string): { field: string; dir: SortDir } | undefined {
  if (!raw) return undefined;
  const [field, dir] = raw.split(':');
  if (!field || !/^[a-zA-Z]+$/.test(field)) return undefined;
  return { field, dir: dir === 'desc' ? 'desc' : 'asc' };
}

/**
 * The size of the whole result set, for list endpoints that are paged. Sent
 * as a header so the response body stays the plain array every other caller
 * of these endpoints already reads.
 */
export const TOTAL_COUNT_HEADER = 'X-Total-Count';

export function sendTotal(res: { setHeader(name: string, value: string | number): unknown }, total: number) {
  res.setHeader(TOTAL_COUNT_HEADER, total);
}
