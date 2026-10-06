'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from './api';

export type SortDir = 'asc' | 'desc';
export interface SortState {
  id: string;
  dir: SortDir;
}

export interface PaginationState {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions: number[];
}

export const PAGE_SIZES = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

const sameDeps = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not load this list. Check your connection and try again.');

// ---------------------------------------------------------------------------
// Pure helpers (also what the tests exercise)

/**
 * Sorts a copy of `rows` by whatever `get` reads from each. Numbers compare as
 * numbers, text as text with "10" after "9", and blanks always go last
 * whichever way the column is sorted. Equal rows keep their original order.
 */
export function sortRows<T>(rows: T[], get: (row: T) => string | number | null | undefined, dir: SortDir): T[] {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((x, y) => {
      const xb = blank(x.value);
      const yb = blank(y.value);
      if (xb && yb) return x.index - y.index;
      if (xb) return 1;
      if (yb) return -1;
      const c =
        typeof x.value === 'number' && typeof y.value === 'number'
          ? x.value - y.value
          : String(x.value).localeCompare(String(y.value), undefined, { numeric: true, sensitivity: 'base' });
      if (c === 0) return x.index - y.index;
      return dir === 'asc' ? c : -c;
    })
    .map((w) => w.row);
}

/** The page buttons to show: first, last, and a few around the current page, with gaps marked. */
export function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const keep = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => keep.add(n));
  const sorted = [...keep].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Server-side tables: the API sorts and pages, the hook keeps track of where we are

export interface ServerQuery {
  offset: number;
  limit: number;
  /** `field:dir`, ready for the `sort` query parameter. */
  sort: string;
  /** True until the person clicks a column header. Lets a search keep its relevance order. */
  sortIsDefault: boolean;
}

/**
 * One page of a list that lives on the server.
 *
 *  - changing `deps` (search text, tab, filter) goes back to page one and the default sort
 *  - clicking a header sorts on the server and goes back to page one
 *  - the rows already on screen stay (dimmed, `loading`) while the next page arrives,
 *    so the table doesn't flash empty between pages
 *  - a slow response for an old query can't overwrite a newer one
 *  - if the last row of the last page goes away, it steps back a page instead of showing "empty"
 *  - `reload()` refreshes the page on screen after an edit without moving
 */
export function useServerTable<T>(opts: {
  fetcher: (q: ServerQuery) => Promise<{ items: T[]; total: number }>;
  deps: unknown[];
  defaultSort: SortState;
  pageSize?: number;
}) {
  const { deps, defaultSort } = opts;
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts.pageSize ?? DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Adjusting state while rendering (React's documented pattern) so a filter
  // change and the reset to page one land in a single fetch, not two.
  const [prevDeps, setPrevDeps] = useState(deps);
  if (!sameDeps(prevDeps, deps)) {
    setPrevDeps(deps);
    setPage(1);
    setSortState(null);
  }

  const sort = sortState ?? defaultSort;
  const sortKey = `${sort.id}:${sort.dir}`;
  const sortIsDefault = sortState === null;

  const fetcherRef = useRef(opts.fetcher);
  fetcherRef.current = opts.fetcher;
  const seq = useRef(0);

  // Everything that changes what the server should return. A string, so the
  // effect re-runs exactly when the query changes (the filters in `deps` are
  // plain values: search text, tab, ids).
  const runKey = JSON.stringify([...deps.map((d) => (d === undefined ? null : d)), page, pageSize, sortKey, sortIsDefault, tick]);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    fetcherRef
      .current({ offset: (page - 1) * pageSize, limit: pageSize, sort: sortKey, sortIsDefault })
      .then(({ items, total: all }) => {
        if (id !== seq.current) return;
        const lastPage = Math.max(1, Math.ceil(all / pageSize));
        if (items.length === 0 && all > 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setRows(items);
        setTotal(all);
        setLoading(false);
      })
      .catch((err) => {
        if (id !== seq.current) return;
        setError(errorMessage(err));
        setRows((prev) => prev ?? []);
        setLoading(false);
      });
    // runKey stands in for the query the closure above was built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const onSortChange = useCallback((next: SortState) => {
    setSortState(next);
    setPage(1);
  }, []);
  const onPageSizeChange = useCallback((n: number) => {
    setPageSize(n);
    setPage(1);
  }, []);

  const pagination: PaginationState = { page, pageSize, total, onPageChange: setPage, onPageSizeChange, pageSizeOptions: PAGE_SIZES };

  return {
    rows,
    total,
    loading,
    error,
    reload,
    sort,
    sortIsDefault,
    onSortChange,
    pagination,
    /** Spread onto <DataTable>. */
    tableProps: { rows, loading, error, onRetry: reload, sort, onSortChange, pagination },
  };
}

// ---------------------------------------------------------------------------
// Client-side tables: everything is already loaded, the hook sorts and pages it

export function useClientTable<T>(opts: {
  rows: T[] | null;
  /** How to read each sortable column's value from a row, by column id. */
  sortValues: Record<string, (row: T) => string | number | null | undefined>;
  defaultSort: SortState;
  /** Changing any of these goes back to page one and the default sort. */
  deps?: unknown[];
  pageSize?: number;
  error?: string | null;
  onRetry?: () => void;
}) {
  const deps = opts.deps ?? [];
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(opts.pageSize ?? DEFAULT_PAGE_SIZE);

  const [prevDeps, setPrevDeps] = useState(deps);
  if (!sameDeps(prevDeps, deps)) {
    setPrevDeps(deps);
    setPage(1);
    setSortState(null);
  }

  const sort = sortState ?? opts.defaultSort;
  const valuesRef = useRef(opts.sortValues);
  valuesRef.current = opts.sortValues;

  const sorted = useMemo(() => {
    if (!opts.rows) return null;
    const get = valuesRef.current[sort.id];
    return get ? sortRows(opts.rows, get, sort.dir) : opts.rows;
    // sortValues is read through a ref (it is usually an inline object); the
    // things it depends on are passed as `deps`, which are listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.rows, sort.id, sort.dir, ...deps]);

  const total = sorted?.length ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, lastPage);
  const pageRows = sorted ? sorted.slice((current - 1) * pageSize, current * pageSize) : null;

  const onSortChange = useCallback((next: SortState) => {
    setSortState(next);
    setPage(1);
  }, []);
  const onPageSizeChange = useCallback((n: number) => {
    setPageSize(n);
    setPage(1);
  }, []);

  const pagination: PaginationState = { page: current, pageSize, total, onPageChange: setPage, onPageSizeChange, pageSizeOptions: PAGE_SIZES };

  return {
    /** The rows on the current page. */
    rows: pageRows,
    /** Every row after sorting, ignoring paging (for exports). */
    sortedRows: sorted,
    sort,
    onSortChange,
    pagination,
    tableProps: { rows: pageRows, loading: false, error: opts.error ?? null, onRetry: opts.onRetry, sort, onSortChange, pagination },
  };
}

// ---------------------------------------------------------------------------
// Row selection

export interface RowSelection<T> {
  count: number;
  /** The selected rows themselves, across every page visited. */
  items: T[];
  has: (key: string) => boolean;
  toggle: (row: T) => void;
  setMany: (rows: T[], on: boolean) => void;
  replace: (rows: T[]) => void;
  clear: () => void;
}

/**
 * Which rows are ticked. Whole rows are kept (not just ids) so a bulk action
 * still has them after the person pages on. Changing `resetDeps` (a new
 * search, filter or tab) clears it: a selection should never silently include
 * rows that are no longer on screen under the current filters.
 */
export function useRowSelection<T>(rowKey: (row: T) => string, resetDeps: unknown[] = []): RowSelection<T> {
  const [map, setMap] = useState<Map<string, T>>(() => new Map());
  const keyRef = useRef(rowKey);
  keyRef.current = rowKey;

  const [prevDeps, setPrevDeps] = useState(resetDeps);
  if (!sameDeps(prevDeps, resetDeps)) {
    setPrevDeps(resetDeps);
    setMap(new Map());
  }

  const has = useCallback((key: string) => map.has(key), [map]);
  const toggle = useCallback((row: T) => {
    setMap((prev) => {
      const next = new Map(prev);
      const k = keyRef.current(row);
      if (next.has(k)) next.delete(k);
      else next.set(k, row);
      return next;
    });
  }, []);
  const setMany = useCallback((rows: T[], on: boolean) => {
    setMap((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        const k = keyRef.current(row);
        if (on) next.set(k, row);
        else next.delete(k);
      }
      return next;
    });
  }, []);
  const replace = useCallback((rows: T[]) => setMap(new Map(rows.map((r) => [keyRef.current(r), r] as const))), []);
  const clear = useCallback(() => setMap(new Map()), []);

  return useMemo(() => ({ count: map.size, items: [...map.values()], has, toggle, setMany, replace, clear }), [map, has, toggle, setMany, replace, clear]);
}
