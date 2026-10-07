'use client';

import { useState } from 'react';
import { Download, MessageCircle, Pencil, Phone, Plus, Search, UserSquare2, X } from 'lucide-react';
import { contactsApi, type Contact } from '../../../lib/contacts-api';
import { ContactFormDrawer } from '../../../components/contacts/ContactFormDrawer';
import { useDebounced } from '../../../lib/use-debounced';
import { useRowSelection, useServerTable } from '../../../lib/use-data-table';
import { downloadCsv } from '../../../lib/csv';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import type { RowAction } from '../../../components/ui/ActionMenu';
import { waHref } from '../../../lib/phone';
import { ApiError } from '../../../lib/api';
import { toast } from '../../../components/ui/Toast';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };
const buttonStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' };

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const table = useServerTable<Contact>({
    fetcher: (q) => contactsApi.listPage(debouncedSearch || undefined, { offset: q.offset, limit: q.limit }, q.sort),
    deps: [debouncedSearch],
    defaultSort: { id: 'name', dir: 'asc' },
  });
  const { rows: contacts, reload: load } = table;
  const selection = useRowSelection<Contact>((c) => c.id, [debouncedSearch]);

  function openEdit(c: Contact) {
    setEditing(c);
    setFormOpen(true);
  }

  function exportRows(rows: Contact[], name: string) {
    const head = ['Name', 'Company', 'Role', 'Phone', 'Alternative phone', 'Tags'];
    downloadCsv(
      `${name}-${new Date().toISOString().slice(0, 10)}.csv`,
      [head, ...rows.map((c) => [c.name, c.company, c.role, c.phone, c.altPhone, c.tags.join('; ')])],
    );
    toast.success(`Exported ${rows.length} contact${rows.length === 1 ? '' : 's'}`);
  }

  async function exportAll() {
    setExporting(true);
    setError(null);
    try {
      exportRows(await contactsApi.list(debouncedSearch || undefined), 'contacts');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export contacts.');
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Contact>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (c) => (
        <>
          <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {c.name}
          </p>
          {c.company && (
            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
              {c.company}
            </p>
          )}
        </>
      ),
    },
    { id: 'role', header: 'Role', sortable: true, cell: (c) => <span style={{ color: 'var(--color-ink-600)' }}>{c.role ?? '—'}</span> },
    {
      id: 'phone',
      header: 'Phone',
      sortable: true,
      cell: (c) =>
        c.phone ? (
          <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="hover:underline" style={{ color: 'var(--color-ink-900)' }}>
            {c.phone}
          </a>
        ) : (
          <span style={{ color: 'var(--color-ink-600)' }}>—</span>
        ),
    },
    {
      id: 'tags',
      header: 'Tags',
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.tags.map((t) => (
            <span key={t} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>
              {t}
            </span>
          ))}
        </div>
      ),
    },
  ];

  const renderCard = (c: Contact) => (
    <div className="flex flex-col gap-1">
      <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {c.name}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
        {[c.role, c.company, c.phone].filter(Boolean).join(' · ') || '—'}
      </p>
    </div>
  );

  const actions = (c: Contact): (RowAction | false)[] => [
    !!c.phone && { label: 'Call', icon: Phone, href: `tel:${c.phone}`, hint: c.phone },
    !!c.phone && { label: 'WhatsApp', icon: MessageCircle, href: waHref(c.phone), external: true },
    { label: 'Edit contact', icon: Pencil, onClick: () => openEdit(c) },
  ];

  const bulkActions = (
    <button type="button" onClick={() => exportRows(selection.items, 'contacts-selected')} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={buttonStyle}>
      <Download size={14} strokeWidth={2} />
      Export selected
    </button>
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Contacts
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Suppliers, drivers, technicians - the operational phonebook
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportAll} disabled={exporting || !contacts || contacts.length === 0} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50" style={buttonStyle}>
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
            Add contact
          </button>
        </div>
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} role="alert" className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error} <span className="underline">Dismiss</span>
        </button>
      )}

      <div className="relative mt-5 max-w-sm">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
        <input
          type="search"
          aria-label="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or role"
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
        <DataTable<Contact>
          {...table.tableProps}
          caption="Contacts"
          columns={columns}
          rowKey={(c) => c.id}
          rowLabel={(c) => c.name}
          onRowClick={openEdit}
          actions={actions}
          renderCard={renderCard}
          selection={selection}
          selectAllMatching={() => contactsApi.list(debouncedSearch || undefined)}
          bulkActions={bulkActions}
          empty={
            <>
              <UserSquare2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {search ? 'No contacts match your search' : 'No contacts yet'}
              </p>
            </>
          }
        />
      </div>

      <ContactFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} contact={editing} />
    </div>
  );
}
