'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export const PAGE_SIZE = 50;

/** Trailing-edge debounce for a search box. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * A list that loads one page at a time. `fetchPage(offset, limit)` returns
 * rows; the hook asks for one more than a page so it knows whether "Show
 * more" is worth showing without a count endpoint.
 *
 *  - `items` is null until the first page arrives (drives the skeleton)
 *  - changing `deps` (search text, tab, filter) starts again from page one
 *  - `reload()` refreshes what's already on screen after an edit, without
 *    collapsing back to page one
 *  - a slow response for an old search can't overwrite a newer one
 */
export function usePagedList<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>, deps: unknown[], pageSize = PAGE_SIZE) {
  const [items, setItems] = useState<T[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const itemsRef = useRef<T[] | null>(null);
  itemsRef.current = items;
  const seq = useRef(0);

  const message = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not load this list. Check your connection and try again.');

  const loadFirst = useCallback(
    async (count: number) => {
      const id = ++seq.current;
      setError(null);
      try {
        const rows = await fetchRef.current(0, count + 1);
        if (id !== seq.current) return;
        setHasMore(rows.length > count);
        setItems(rows.slice(0, count));
      } catch (err) {
        if (id !== seq.current) return;
        setError(message(err));
        setItems((prev) => prev ?? []);
      }
    },
    [],
  );

  useEffect(() => {
    setItems(null);
    void loadFirst(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(async () => {
    const current = itemsRef.current;
    if (!current) return;
    const id = seq.current;
    setLoadingMore(true);
    setError(null);
    try {
      const rows = await fetchRef.current(current.length, pageSize + 1);
      if (id !== seq.current) return;
      setHasMore(rows.length > pageSize);
      setItems([...current, ...rows.slice(0, pageSize)]);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoadingMore(false);
    }
  }, [pageSize]);

  const reload = useCallback(() => loadFirst(Math.max(itemsRef.current?.length ?? 0, pageSize)), [loadFirst, pageSize]);

  return { items, hasMore, loadingMore, error, loadMore, reload };
}
