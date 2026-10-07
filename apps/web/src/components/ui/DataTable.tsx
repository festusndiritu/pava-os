'use client';

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { PaginationState, RowSelection, SortDir, SortState } from '../../lib/use-data-table';
import { fmtNumber } from '../../lib/format';
import { TablePagination } from './TablePagination';
import { Select } from './inputs';
import { ActionMenu, actionList, type RowActionInput } from './ActionMenu';

export interface Column<T> {
  /** Also the sort key sent to the server (or read by a client-side sort). */
  id: string;
  header: ReactNode;
  /** Plain-text name, for screen readers and tooltips. Defaults to `header` when that is text. */
  label?: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Which way the first click sorts. Dates and amounts usually want 'desc'. */
  defaultDir?: SortDir;
  /** Drop this column on narrower desktop widths. Phones always get cards. */
  hideBelow?: 'lg' | 'xl';
  className?: string;
}

const HIDE_BELOW = { lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' } as const;
const border = { borderColor: 'var(--color-border)' };

export interface DataTableProps<T> {
  columns: Column<T>[];
  /** null while the first load is in flight. */
  rows: T[] | null;
  rowKey: (row: T) => string;
  /** Names the table for screen readers, e.g. "Products". */
  caption: string;
  /** Names a row for its checkbox, e.g. the product name. */
  rowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  /**
   * What can be done to this row, collected behind one "⋮" button at its end
   * (a popover on desktop, a bottom sheet on phones). Conditions can be
   * written inline: `isAdmin && { label: 'Edit', … }`. A row with nothing to
   * offer shows no button.
   */
  actions?: (row: T) => RowActionInput[];
  /** The body of a row's card on phones. Everything the table shows, in the layout a phone wants. */
  renderCard: (row: T) => ReactNode;
  /** Extra content under a row, opened by a chevron (or by the row itself when it has no onRowClick). */
  detail?: (row: T) => ReactNode;

  sort?: SortState | null;
  onSortChange?: (next: SortState) => void;

  selection?: RowSelection<T>;
  /** Buttons shown in the bar that appears while rows are ticked. */
  bulkActions?: ReactNode;
  /** Offer "select all N matching" once a whole page is ticked. Resolves to every matching row. */
  selectAllMatching?: () => Promise<T[]>;

  pagination?: PaginationState;
  /** True while the next page or sort is loading; the rows on screen dim instead of vanishing. */
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** What to show when there are no rows (and no error). */
  empty: ReactNode;
  skeletonRows?: number;
}

function SortButton<T>({ column, sort, onSortChange }: { column: Column<T>; sort?: SortState | null; onSortChange: (next: SortState) => void }) {
  const active = sort?.id === column.id;
  const next: SortDir = active ? (sort!.dir === 'asc' ? 'desc' : 'asc') : (column.defaultDir ?? 'asc');
  const Icon = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
  const name = column.label ?? (typeof column.header === 'string' ? column.header : column.id);
  return (
    <button
      type="button"
      onClick={() => onSortChange({ id: column.id, dir: next })}
      title={`Sort by ${name}, ${next === 'asc' ? 'ascending' : 'descending'}`}
      className="-mx-1.5 inline-flex min-h-8 items-center gap-1 rounded px-1.5 font-medium transition-colors hover:bg-[var(--color-border)]"
      style={{ color: active ? 'var(--color-ink-900)' : 'var(--color-ink-600)' }}
    >
      {column.header}
      <Icon size={13} strokeWidth={2} aria-hidden style={{ opacity: active ? 1 : 0.5 }} />
    </button>
  );
}

function Checkbox({ checked, indeterminate, label, onClick }: { checked: boolean; indeterminate?: boolean; label: string; onClick: (e: MouseEvent<HTMLInputElement>) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <label className="flex h-11 w-11 cursor-pointer items-center justify-center md:h-9 md:w-9">
      {/* The click handler does the work (it can see shiftKey); onChange only keeps React's controlled input quiet. */}
      <input ref={ref} type="checkbox" checked={checked} onChange={() => {}} onClick={onClick} aria-label={label} className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]" />
    </label>
  );
}

/**
 * The one table every list screen uses. It owns the markup and the behaviour
 * (sortable headers, row selection with shift-click ranges and a bulk-action
 * bar, paging with a real total, loading / empty / error states, expandable
 * rows, and a card layout on phones); a screen supplies columns and rows, and
 * a hook from lib/use-data-table says where the rows come from.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  rowLabel,
  onRowClick,
  actions,
  renderCard,
  detail,
  sort,
  onSortChange,
  selection,
  bulkActions,
  selectAllMatching,
  pagination,
  loading,
  error,
  onRetry,
  empty,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const lastIndex = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstPage = useRef(true);

  // A new page or filter is a different set of rows; an old range anchor or open row means nothing there.
  useEffect(() => {
    lastIndex.current = null;
    setExpanded(null);
    // Moving to another page of a long table: bring its top back into view
    // (not on first render, and not if the top is already visible).
    if (firstPage.current) firstPage.current = false;
    else if (rootRef.current && rootRef.current.getBoundingClientRect().top < 0) rootRef.current.scrollIntoView({ block: 'start' });
  }, [pagination?.page, pagination?.pageSize]);

  const selectable = !!selection;
  const hasRows = !!rows && rows.length > 0;
  const status: 'loading' | 'error' | 'empty' | 'rows' = error && !hasRows ? 'error' : rows === null ? 'loading' : rows.length === 0 ? 'empty' : 'rows';
  const colCount = (selectable ? 1 : 0) + (detail ? 1 : 0) + columns.length + (actions ? 1 : 0);

  const pageKeys = rows?.map(rowKey) ?? [];
  const selectedOnPage = selection ? pageKeys.filter((k) => selection.has(k)).length : 0;
  const allOnPage = hasRows && selectedOnPage === pageKeys.length;
  const someOnPage = selectedOnPage > 0 && !allOnPage;

  function togglePage() {
    if (!selection || !rows) return;
    selection.setMany(rows, !allOnPage);
    lastIndex.current = null;
  }

  function onCheck(e: MouseEvent<HTMLInputElement>, index: number, row: T) {
    if (!selection || !rows) return;
    if (e.shiftKey && lastIndex.current !== null && lastIndex.current !== index) {
      const [a, b] = [Math.min(lastIndex.current, index), Math.max(lastIndex.current, index)];
      // Follow whatever the clicked row is about to become, so shift-click ticks or unticks the whole stretch.
      selection.setMany(rows.slice(a, b + 1), !selection.has(rowKey(row)));
    } else {
      selection.toggle(row);
    }
    lastIndex.current = index;
  }

  async function selectEverything() {
    if (!selectAllMatching || !selection) return;
    setSelectingAll(true);
    setSelectError(null);
    try {
      selection.replace(await selectAllMatching());
    } catch {
      setSelectError('Could not select every match. Try again.');
    } finally {
      setSelectingAll(false);
    }
  }

  function activate(row: T) {
    if (onRowClick) onRowClick(row);
    else if (detail) setExpanded((cur) => (cur === rowKey(row) ? null : rowKey(row)));
  }

  function onRowKeyDown(e: KeyboardEvent<HTMLElement>, row: T) {
    // Only the row itself: Enter or Space on a checkbox or button inside it belongs to that control.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(row);
    }
  }

  const clickable = !!onRowClick || !!detail;
  const sortOptions = columns
    .filter((c) => c.sortable)
    .flatMap((c) => {
      const name = c.label ?? (typeof c.header === 'string' ? c.header : c.id);
      return [
        { value: `${c.id}:asc`, label: `${name} ↑` },
        { value: `${c.id}:desc`, label: `${name} ↓` },
      ];
    });
  const total = pagination?.total ?? rows?.length ?? 0;
  const moreThanPage = !!rows && total > rows.length;
  const everythingSelected = !!selection && moreThanPage && selection.count >= total;

  const errorBlock = (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-medium" style={{ color: 'var(--color-status-bad)' }}>
        {error}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-10 rounded-md border px-3 text-sm font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
          Try again
        </button>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="overflow-hidden rounded-lg border" style={border} aria-busy={loading || status === 'loading'}>
      {selection && selection.count > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5" style={{ ...border, backgroundColor: 'var(--color-accent-soft)' }}>
          <span aria-live="polite" className="text-sm font-semibold data-num" style={{ color: 'var(--color-accent)' }}>
            {fmtNumber(selection.count)} selected
          </span>
          {selectAllMatching && allOnPage && moreThanPage && !everythingSelected && (
            <span className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              All {rows!.length} on this page are selected.{' '}
              <button type="button" onClick={selectEverything} disabled={selectingAll} className="font-medium underline disabled:opacity-60" style={{ color: 'var(--color-accent)' }}>
                {selectingAll ? 'Selecting…' : `Select all ${fmtNumber(total)} matching`}
              </button>
            </span>
          )}
          {everythingSelected && (
            <span className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
              All {fmtNumber(total)} matching are selected.
            </span>
          )}
          {selectError && (
            <span role="alert" className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {selectError}
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions}
            <button type="button" onClick={selection.clear} className="min-h-10 rounded-md px-3 text-sm font-medium" style={{ color: 'var(--color-ink-600)' }}>
              Clear selection
            </button>
          </div>
        </div>
      )}

      {error && hasRows && (
        <div role="alert" className="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm" style={{ ...border, backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          <span>{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 font-medium underline">
              Try again
            </button>
          )}
        </div>
      )}

      {/* Desktop and tablet: the table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b text-left" style={{ ...border, backgroundColor: 'var(--color-bg)' }}>
              {selectable && (
                <th scope="col" className="w-12 px-2 py-1">
                  <Checkbox checked={allOnPage} indeterminate={someOnPage} label="Select all on this page" onClick={togglePage} />
                </th>
              )}
              {detail && (
                <th scope="col" className="w-10 px-1">
                  <span className="sr-only">Details</span>
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={c.sortable ? (sort?.id === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  className={`px-4 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : ''} ${c.hideBelow ? HIDE_BELOW[c.hideBelow] : ''}`}
                  style={{ color: 'var(--color-ink-600)' }}
                >
                  {c.sortable && onSortChange ? <SortButton column={c} sort={sort} onSortChange={onSortChange} /> : c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="w-14 px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody style={{ opacity: loading && status === 'rows' ? 0.55 : 1, transition: 'opacity 120ms' }}>
            {status === 'loading' &&
              [...Array(skeletonRows)].map((_, i) => (
                <tr key={i} className="border-b" style={border}>
                  <td className="px-4 py-3" colSpan={colCount}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}
            {status === 'error' && (
              <tr>
                <td colSpan={colCount}>{errorBlock}</td>
              </tr>
            )}
            {status === 'empty' && (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center">
                  {empty}
                </td>
              </tr>
            )}
            {status === 'rows' &&
              rows!.map((row, index) => {
                const key = rowKey(row);
                const selected = !!selection?.has(key);
                const open = expanded === key;
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={clickable ? () => activate(row) : undefined}
                      onKeyDown={clickable ? (e) => onRowKeyDown(e, row) : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      className={`border-b transition-colors last:border-0 hover:bg-[var(--color-bg)] focus-visible:bg-[var(--color-bg)] ${clickable ? 'cursor-pointer' : ''}`}
                      style={{ ...border, backgroundColor: selected ? 'var(--color-accent-soft)' : undefined }}
                    >
                      {selectable && (
                        <td className="w-12 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected} label={`Select ${rowLabel ? rowLabel(row) : 'row'}`} onClick={(e) => onCheck(e, index, row)} />
                        </td>
                      )}
                      {detail && (
                        <td className="w-10 px-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={`${open ? 'Hide' : 'Show'} details${rowLabel ? ` for ${rowLabel(row)}` : ''}`}
                            onClick={() => setExpanded(open ? null : key)}
                            className="flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ color: 'var(--color-ink-600)' }}
                          >
                            {open ? <ChevronDown size={15} strokeWidth={2} /> : <ChevronRight size={15} strokeWidth={2} />}
                          </button>
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.id} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : ''} ${c.hideBelow ? HIDE_BELOW[c.hideBelow] : ''} ${c.className ?? ''}`}>
                          {c.cell(row)}
                        </td>
                      ))}
                      {actions && (
                        <td className="w-14 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <ActionMenu actions={actionList(actions(row))} label={`Actions for ${rowLabel ? rowLabel(row) : 'row'}`} heading={rowLabel?.(row)} />
                          </div>
                        </td>
                      )}
                    </tr>
                    {open && detail && (
                      <tr className="border-b last:border-0" style={{ ...border, backgroundColor: 'var(--color-bg)' }}>
                        <td colSpan={colCount} className="px-4 py-3">
                          {detail(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Phones: cards (brief §63). Same rows, same selection, laid out for a thumb. */}
      <div className="md:hidden">
        {(sortOptions.length > 0 || (selectable && hasRows)) && (
          <div className="flex items-center gap-1 border-b px-2" style={border}>
            {selectable && hasRows && (
              <>
                <Checkbox checked={allOnPage} indeterminate={someOnPage} label="Select all on this page" onClick={togglePage} />
                <span className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                  Select all
                </span>
              </>
            )}
            {sortOptions.length > 0 && onSortChange && (
              // Phones have no column headers to tap, so sorting lives in a menu.
              <label className="ml-auto flex items-center gap-1.5 py-1.5 pr-1 text-xs" style={{ color: 'var(--color-ink-600)' }}>
                Sort
                <Select
                  inline
                  size="sm"
                  aria-label="Sort by"
                  placeholder="Default order"
                  value={sort ? `${sort.id}:${sort.dir}` : ''}
                  onChange={(v) => {
                    const [id, dir] = v.split(':');
                    onSortChange({ id, dir: dir === 'desc' ? 'desc' : 'asc' });
                  }}
                  options={[...(sort && !sortOptions.some((o) => o.value === `${sort.id}:${sort.dir}`) ? [{ value: `${sort.id}:${sort.dir}`, label: 'Default order' }] : []), ...sortOptions]}
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }}
                />
              </label>
            )}
          </div>
        )}
        <div className="divide-y divide-[var(--color-border)]" style={{ opacity: loading && status === 'rows' ? 0.55 : 1, transition: 'opacity 120ms' }}>
          {status === 'loading' &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}
          {status === 'error' && errorBlock}
          {status === 'empty' && <div className="px-4 py-12 text-center">{empty}</div>}
          {status === 'rows' &&
            rows!.map((row, index) => {
              const key = rowKey(row);
              const selected = !!selection?.has(key);
              const open = expanded === key;
              const cardMenu = actions ? actionList(actions(row)) : [];
              const body = renderCard(row);
              return (
                <div key={key} className="px-2 py-3" style={{ backgroundColor: selected ? 'var(--color-accent-soft)' : undefined }}>
                  <div className="flex items-start gap-1">
                    {selectable && <Checkbox checked={selected} label={`Select ${rowLabel ? rowLabel(row) : 'row'}`} onClick={(e) => onCheck(e, index, row)} />}
                    {clickable ? (
                      <button type="button" onClick={() => activate(row)} aria-expanded={detail && !onRowClick ? open : undefined} className={`min-w-0 flex-1 rounded-md py-1 text-left ${selectable ? '' : 'pl-2'} pr-2`}>
                        {body}
                      </button>
                    ) : (
                      <div className={`min-w-0 flex-1 py-1 ${selectable ? '' : 'pl-2'} pr-2`}>{body}</div>
                    )}
                    {cardMenu.length > 0 && <ActionMenu actions={cardMenu} label={`Actions for ${rowLabel ? rowLabel(row) : 'row'}`} heading={rowLabel?.(row)} />}
                  </div>
                  {open && detail && (
                    <div className="mt-2 rounded-md px-3 py-2" style={{ backgroundColor: 'var(--color-bg)' }}>
                      {detail(row)}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {pagination && status !== 'loading' && <TablePagination {...pagination} />}
    </div>
  );
}
