/** Optional `limit` / `offset` query params for list endpoints. */
export const MAX_PAGE_SIZE = 200;

export function parsePaging(limit?: string, offset?: string): { limit?: number; offset?: number } {
  const l = Number.parseInt(limit ?? '', 10);
  const o = Number.parseInt(offset ?? '', 10);
  return {
    limit: Number.isFinite(l) && l > 0 ? Math.min(l, MAX_PAGE_SIZE) : undefined,
    offset: Number.isFinite(o) && o > 0 ? o : undefined,
  };
}

/** `sort=field:dir` from a table header. */
export type SortDir = 'asc' | 'desc';

export const nullsLast = (dir: SortDir) => ({ sort: dir, nulls: 'last' as const });

export function parseSort(raw?: string): { field: string; dir: SortDir } | undefined {
  if (!raw) return undefined;
  const [field, dir] = raw.split(':');
  if (!field || !/^[a-zA-Z]+$/.test(field)) return undefined;
  return { field, dir: dir === 'desc' ? 'desc' : 'asc' };
}

/** The size of the whole result set, for list endpoints that are paged. */
export const TOTAL_COUNT_HEADER = 'X-Total-Count';

export function sendTotal(res: { setHeader(name: string, value: string | number): unknown }, total: number) {
  res.setHeader(TOTAL_COUNT_HEADER, total);
}
