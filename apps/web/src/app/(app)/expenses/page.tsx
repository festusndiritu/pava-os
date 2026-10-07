'use client';

import { useEffect, useState } from 'react';
import { Download, Plus, Receipt } from 'lucide-react';
import { expensesApi, type Expense, type ExpenseCategory, type ExpenseStatus } from '../../../lib/expenses-api';
import { ExpenseFormDrawer } from '../../../components/expenses/ExpenseFormDrawer';
import { ApiError } from '../../../lib/api';
import { money } from '../../../lib/format';
import { useClientTable, useRowSelection } from '../../../lib/use-data-table';
import { downloadCsv } from '../../../lib/csv';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Select } from '../../../components/ui/inputs';
import { toast } from '../../../components/ui/Toast';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const STATUS_STYLE: Record<ExpenseStatus, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Pending', fg: 'var(--color-status-warn)', bg: 'var(--color-status-warnSoft)' },
  APPROVED: { label: 'Approved', fg: 'var(--color-status-ok)', bg: 'var(--color-status-okSoft)' },
  PAID: { label: 'Paid', fg: 'var(--color-ink-600)', bg: 'var(--color-bg)' },
};

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function StatusPill({ status }: { status: ExpenseStatus }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
      {STATUS_STYLE[status].label}
    </span>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<ExpenseStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function load() {
    setLoadError(null);
    try {
      setExpenses(await expensesApi.list({ categoryId: categoryId || undefined, status: status || undefined }));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load expenses. Check your connection and try again.');
      setExpenses((prev) => prev ?? []);
    }
  }

  useEffect(() => {
    expensesApi.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, status]);

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  // Newest first. The whole filtered list is in the browser, so the table sorts and pages it there.
  const table = useClientTable<Expense>({
    rows: expenses,
    sortValues: {
      date: (e) => e.date,
      category: (e) => e.category?.name,
      description: (e) => e.description || e.vendor,
      status: (e) => e.status,
      amount: (e) => e.amount,
    },
    defaultSort: { id: 'date', dir: 'desc' },
    deps: [categoryId, status],
    error: loadError,
    onRetry: load,
  });
  const selection = useRowSelection<Expense>((e) => e.id, [categoryId, status]);
  const selectedTotal = selection.items.reduce((s, e) => s + e.amount, 0);

  function openEdit(e: Expense) {
    setEditing(e);
    setFormOpen(true);
  }

  function exportRows(rows: Expense[], name: string) {
    const head = ['Date', 'Category', 'Description', 'Vendor', 'Status', 'Amount (KSh)'];
    downloadCsv(
      `${name}-${new Date().toISOString().slice(0, 10)}.csv`,
      [head, ...rows.map((e) => [e.date.slice(0, 10), e.category?.name, e.description, e.vendor, STATUS_STYLE[e.status].label, e.amount])],
    );
    toast.success(`Exported ${rows.length} expense${rows.length === 1 ? '' : 's'}`);
  }

  const columns: Column<Expense>[] = [
    { id: 'date', header: 'Date', sortable: true, defaultDir: 'desc', cell: (e) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(e.date)}</span> },
    { id: 'category', header: 'Category', sortable: true, cell: (e) => <span className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{e.category?.name ?? '—'}</span> },
    { id: 'description', header: 'Description', sortable: true, cell: (e) => <span style={{ color: 'var(--color-ink-600)' }}>{e.description || e.vendor || '—'}</span> },
    { id: 'status', header: 'Status', sortable: true, cell: (e) => <StatusPill status={e.status} /> },
    { id: 'amount', header: 'Amount', sortable: true, defaultDir: 'desc', align: 'right', cell: (e) => <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>{money(e.amount)}</span> },
  ];

  const renderCard = (e: Expense) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
          {e.category?.name ?? 'Uncategorised'}
        </p>
        <span className="data-num font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          {money(e.amount)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm" style={{ color: 'var(--color-ink-600)' }}>
        <span>{fmtDate(e.date)}</span>
        <StatusPill status={e.status} />
      </div>
      {(e.description || e.vendor) && (
        <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
          {e.description || e.vendor}
        </p>
      )}
    </div>
  );

  const buttonStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Expenses
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Rent, utilities, repairs, and other operating costs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => expenses && exportRows(table.sortedRows ?? expenses, 'expenses')} disabled={!expenses || expenses.length === 0} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50" style={buttonStyle}>
            <Download size={15} strokeWidth={2} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex min-h-10 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={15} strokeWidth={2} />
            Add expense
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Select inline aria-label="Filter by category" value={categoryId} onChange={setCategoryId} options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} style={inputStyle} />
        <Select
          inline
          aria-label="Filter by status"
          value={status}
          onChange={(v) => setStatus(v as ExpenseStatus | '')}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'PAID', label: 'Paid' },
          ]}
          style={inputStyle}
        />
        {expenses && expenses.length > 0 && (
          <span className="ml-auto text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {selection.count > 0 ? 'Selected' : 'Total'}: <span className="font-semibold data-num" style={{ color: 'var(--color-ink-900)' }}>{money(selection.count > 0 ? selectedTotal : total)}</span>
          </span>
        )}
      </div>

      <div className="mt-5">
        <DataTable<Expense>
          {...table.tableProps}
          caption="Expenses"
          columns={columns}
          rowKey={(e) => e.id}
          rowLabel={(e) => `${e.category?.name ?? 'Expense'} ${fmtDate(e.date)}`}
          onRowClick={openEdit}
          renderCard={renderCard}
          selection={selection}
          selectAllMatching={async () => table.sortedRows ?? []}
          bulkActions={
            <button type="button" onClick={() => exportRows(selection.items, 'expenses-selected')} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={buttonStyle}>
              <Download size={14} strokeWidth={2} />
              Export selected
            </button>
          }
          empty={
            <>
              <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {categoryId || status ? 'No expenses match these filters' : 'No expenses recorded'}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                {categoryId || status ? 'Try a different category or status.' : 'Log rent, utilities, or other operating costs to start tracking them.'}
              </p>
            </>
          }
        />
      </div>

      <ExpenseFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          load();
          expensesApi.categories().then(setCategories).catch(() => {});
        }}
        expense={editing}
      />
    </div>
  );
}
