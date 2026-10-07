'use client';

import { useEffect, useState } from 'react';
import { Archive, Download, Eye, Pencil, Plus, RotateCcw, Search, Users, X } from 'lucide-react';
import { customersApi, type Customer, type CustomerStatus } from '../../../lib/customers-api';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ApiError } from '../../../lib/api';
import { CustomerFormDrawer } from '../../../components/customers/CustomerFormDrawer';
import { CustomerDetailDrawer } from '../../../components/customers/CustomerDetailDrawer';
import { fmtNumber } from '../../../lib/format';
import { useDebounced } from '../../../lib/use-debounced';
import { useRowSelection, useServerTable } from '../../../lib/use-data-table';
import { bulkSummary, runBulk } from '../../../lib/bulk';
import { downloadCsv } from '../../../lib/csv';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import type { RowAction } from '../../../components/ui/ActionMenu';
import { toast } from '../../../components/ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

function CreditBadge({ customer }: { customer: Customer }) {
  if (!customer.isCredit) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
        Cash
      </span>
    );
  }
  const overLimit = customer.creditLimit != null && customer.creditBalance > customer.creditLimit;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: overLimit ? 'var(--color-status-badSoft)' : 'var(--color-status-okSoft)', color: overLimit ? 'var(--color-status-bad)' : 'var(--color-status-ok)' }}
    >
      Credit
    </span>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [status, setStatus] = useState<CustomerStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Customer | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<'archive' | 'restore' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Lets global search (Ctrl/Cmd+K) land straight on a customer's detail
  // drawer via `/customers?open=<id>`, the same drawer a row click opens.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setDetailId(id);
  }, []);

  const debouncedSearch = useDebounced(search);
  const table = useServerTable<Customer>({
    fetcher: (q) => customersApi.listPage(debouncedSearch || undefined, status, { offset: q.offset, limit: q.limit }, q.sort),
    deps: [debouncedSearch, status],
    defaultSort: { id: 'name', dir: 'asc' },
  });
  const { rows: customers, reload: load } = table;
  const selection = useRowSelection<Customer>((c) => c.id, [debouncedSearch, status]);

  const customerName = (c: Customer) => c.businessName || c.name;

  function openEdit(c: Customer) {
    setEditing(c);
    setFormOpen(true);
  }

  async function archiveCustomer(c: Customer) {
    setArchiveBusy(true);
    try {
      await customersApi.archive(c.id);
      setConfirmArchive(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not archive this customer.');
      setConfirmArchive(null);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function restoreCustomer(c: Customer) {
    setError(null);
    try {
      await customersApi.restore(c.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore this customer.');
    }
  }

  async function runBulkArchive(action: 'archive' | 'restore') {
    setBulkBusy(true);
    setError(null);
    try {
      const result = await runBulk(selection.items, (c) => (action === 'archive' ? customersApi.archive(c.id) : customersApi.restore(c.id)));
      const text = bulkSummary(action === 'archive' ? 'Archived' : 'Restored', 'customer', result);
      if (result.failed.length === 0) toast.success(text);
      else setError(text);
      selection.replace(result.failed.map((f) => f.item)); // what failed stays ticked, to retry
      setBulkConfirm(null);
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  function exportRows(rows: Customer[], name: string) {
    const head = ['Name', 'Business', 'Phone', 'Type', 'Credit balance (KSh)', 'Credit limit (KSh)'];
    const body = rows.map((c) => [c.name, c.businessName, c.phone, c.isCredit ? 'Credit' : 'Cash', c.isCredit ? c.creditBalance : '', c.isCredit ? (c.creditLimit ?? '') : '']);
    downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
    toast.success(`Exported ${rows.length} customer${rows.length === 1 ? '' : 's'}`);
  }

  async function exportAll() {
    setExporting(true);
    setError(null);
    try {
      exportRows(await customersApi.list(debouncedSearch || undefined, status), 'customers');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export customers.');
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Customer>[] = [
    {
      id: 'name',
      header: 'Customer',
      sortable: true,
      cell: (c) => (
        <>
          <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {c.name}
          </p>
          {c.businessName && (
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {c.businessName}
            </p>
          )}
        </>
      ),
    },
    { id: 'phone', header: 'Phone', sortable: true, cell: (c) => <span style={{ color: 'var(--color-ink-600)' }}>{c.phone ?? '—'}</span> },
    { id: 'type', header: 'Type', sortable: true, cell: (c) => <CreditBadge customer={c} /> },
    {
      id: 'balance',
      header: 'Balance',
      sortable: true,
      defaultDir: 'desc',
      align: 'right',
      cell: (c) => (
        <span className="font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
          {c.isCredit ? `KSh ${fmtNumber(c.creditBalance)}` : '—'}
        </span>
      ),
    },
  ];

  const renderCard = (c: Customer) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {c.name}
          </p>
          {c.businessName && (
            <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {c.businessName}
            </p>
          )}
        </div>
        {c.isCredit && (
          <p className="shrink-0 font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
            KSh {fmtNumber(c.creditBalance)}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-ink-600)' }}>{c.phone ?? '—'}</span>
        <CreditBadge customer={c} />
      </div>
    </div>
  );

  const actions = (c: Customer): RowAction[] => [
    { label: 'View customer', icon: Eye, onClick: () => setDetailId(c.id) },
    { label: 'Edit customer', icon: Pencil, onClick: () => openEdit(c) },
    c.active ? { label: 'Archive', icon: Archive, tone: 'danger', separatorBefore: true, onClick: () => setConfirmArchive(c) } : { label: 'Restore', icon: RotateCcw, tone: 'accent', separatorBefore: true, onClick: () => restoreCustomer(c) },
  ];

  const buttonStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' };
  const bulkActions = (
    <>
      <button type="button" onClick={() => exportRows(selection.items, 'customers-selected')} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={buttonStyle}>
        <Download size={14} strokeWidth={2} />
        Export selected
      </button>
      <button
        type="button"
        onClick={() => setBulkConfirm(status === 'active' ? 'archive' : 'restore')}
        className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
        style={{ ...buttonStyle, color: status === 'active' ? 'var(--color-status-bad)' : 'var(--color-accent)' }}
      >
        {status === 'active' ? <Archive size={14} strokeWidth={2} /> : <RotateCcw size={14} strokeWidth={2} />}
        {status === 'active' ? 'Archive selected' : 'Restore selected'}
      </button>
    </>
  );

  const owedBySelection = selection.items.filter((c) => c.isCredit && c.creditBalance > 0);
  const owedTotal = owedBySelection.reduce((sum, c) => sum + c.creditBalance, 0);

  const emptyState = (
    <>
      <Users size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {search ? 'No customers match your search' : status === 'archived' ? 'No archived customers' : 'No customers yet'}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {search ? 'Try a different name, business or phone number.' : status === 'archived' ? 'Customers you archive will show up here.' : 'Add your first customer to start tracking purchases and credit.'}
      </p>
    </>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Customers
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Profiles, credit accounts, and outstanding balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportAll} disabled={exporting || !customers || customers.length === 0} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50" style={buttonStyle}>
            <Download size={15} strokeWidth={2} />
            {exporting ? 'Exporting…' : 'Export CSV'}
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
            Add customer
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5" role="group" aria-label="Customer status">
        {(['active', 'archived'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className="min-h-9 rounded-md border px-3 text-sm font-medium"
            style={{
              borderColor: status === s ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: status === s ? 'var(--color-accent-soft)' : 'transparent',
              color: status === s ? 'var(--color-accent)' : 'var(--color-ink-600)',
            }}
          >
            {s === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} role="alert" className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error} <span className="underline">Dismiss</span>
        </button>
      )}

      <div className="relative mt-3 max-w-sm">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
        <input
          type="search"
          aria-label="Search customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, business, or phone"
          className="w-full rounded-md border py-2 pl-8 pr-9 text-sm outline-none focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
          style={inputStyle}
        />
        {search && (
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-5">
        <DataTable<Customer>
          {...table.tableProps}
          caption="Customers"
          columns={columns}
          rowKey={(c) => c.id}
          rowLabel={customerName}
          onRowClick={(c) => setDetailId(c.id)}
          actions={actions}
          renderCard={renderCard}
          selection={selection}
          selectAllMatching={() => customersApi.list(debouncedSearch || undefined, status)}
          bulkActions={bulkActions}
          empty={emptyState}
        />
      </div>

      <CustomerFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} customer={editing} />
      <CustomerDetailDrawer
        customerId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(c) => {
          setDetailId(null);
          openEdit(c);
        }}
        onChanged={load}
      />

      {confirmArchive && (
        <ConfirmDialog
          title="Archive this customer?"
          description={`${confirmArchive.businessName || confirmArchive.name} will drop off the customer list and the POS. Their documents and ledger history are unaffected, and they can be restored any time.${
            confirmArchive.isCredit && confirmArchive.creditBalance > 0 ? ` They currently owe KSh ${fmtNumber(confirmArchive.creditBalance)}.` : ''
          }`}
          confirmLabel="Archive"
          busy={archiveBusy}
          onCancel={() => setConfirmArchive(null)}
          onConfirm={() => archiveCustomer(confirmArchive)}
        />
      )}

      {bulkConfirm && (
        <ConfirmDialog
          title={`${bulkConfirm === 'archive' ? 'Archive' : 'Restore'} ${selection.count} customer${selection.count === 1 ? '' : 's'}?`}
          description={
            bulkConfirm === 'archive'
              ? `They will drop off the customer list and the POS. Documents and ledger history are unaffected, and they can be restored any time.${
                  owedBySelection.length > 0 ? ` ${owedBySelection.length} of them still owe money, KSh ${fmtNumber(owedTotal)} in all.` : ''
                }`
              : 'They will return to the customer list and the POS.'
          }
          confirmLabel={bulkConfirm === 'archive' ? 'Archive' : 'Restore'}
          busy={bulkBusy}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => runBulkArchive(bulkConfirm)}
        />
      )}
    </div>
  );
}
