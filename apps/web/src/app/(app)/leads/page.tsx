'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, Download, MapPin, MessageCircle, Pencil, Phone, Plus, RotateCcw, Search, Target, UserPlus, X } from 'lucide-react';
import { leadsApi, type Lead } from '../../../lib/leads-api';
import { LeadFormDrawer } from '../../../components/leads/LeadFormDrawer';
import { ApiError } from '../../../lib/api';
import { fmtNumber } from '../../../lib/format';
import { useClientTable, useRowSelection } from '../../../lib/use-data-table';
import { bulkSummary, runBulk } from '../../../lib/bulk';
import { downloadCsv } from '../../../lib/csv';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import type { RowAction } from '../../../components/ui/ActionMenu';
import { waHref } from '../../../lib/phone';
import { toast } from '../../../components/ui/Toast';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

/**
 * This used to be an 8-stage Kanban board. What people here actually do with
 * a lead is simpler: save a contact, jot what they said, and get reminded
 * when to follow up — "bring stuff", "he's sending a list for a quote",
 * "check back next week". So the page is organised around that: a plain
 * list sorted by whoever's follow-up is soonest, with the pipeline stage
 * folded down into a lightweight filter instead of the main structure.
 */

type Tab = 'open' | 'won' | 'lost' | 'archived';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function followUpInfo(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: 'No follow-up set', color: 'var(--color-ink-600)' };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(iso);
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (diffDays < 0) return { label: `Overdue · ${fmtDate(iso)}`, color: 'var(--color-status-bad)' };
  if (diffDays === 0) return { label: 'Follow up today', color: 'var(--color-status-warn)' };
  if (diffDays === 1) return { label: 'Follow up tomorrow', color: 'var(--color-ink-900)' };
  return { label: `Follow up ${fmtDate(iso)}`, color: 'var(--color-ink-900)' };
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Active' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'archived', label: 'Archived' },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [archived, setArchived] = useState<Lead[] | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<'archive' | 'restore' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLeads(await leadsApi.list('active'));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === 'archived' && archived === null) {
      leadsApi.list('archived').then(setArchived);
    }
  }, [tab, archived]);

  // Lets global search (Ctrl/Cmd+K) land straight on a lead's edit drawer
  // via `/leads?open=<id>`, regardless of which tab it'd otherwise fall
  // under — a lead fetched by id doesn't depend on the lists above.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) leadsApi.get(id).then((l) => { setEditing(l); setFormOpen(true); }).catch(() => {});
  }, []);

  function openEdit(lead: Lead) {
    setEditing(lead);
    setFormOpen(true);
  }

  async function convert(lead: Lead) {
    setError(null);
    try {
      await leadsApi.convertToCustomer(lead.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not convert this lead.');
    }
  }

  async function archiveLead(lead: Lead) {
    await leadsApi.archive(lead.id);
    setArchived(null);
    load();
  }

  async function restoreLead(lead: Lead) {
    await leadsApi.restore(lead.id);
    setArchived(null);
    load();
  }

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const source = tab === 'archived' ? archived : leads;
    if (!source) return null;
    const bucketed =
      tab === 'won' ? source.filter((l) => l.stage === 'WON')
      : tab === 'lost' ? source.filter((l) => l.stage === 'LOST')
      : tab === 'archived' ? source
      : source.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
    const filtered = q
      ? bucketed.filter((l) => [l.name, l.company, l.phone, l.location, l.notes].some((v) => v?.toLowerCase().includes(q)))
      : bucketed;
    return filtered;
  }, [tab, leads, archived, q]);

  const overdueCount = leads?.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST' && l.followUpAt && new Date(l.followUpAt) < new Date()).length ?? 0;

  // Follow-up soonest first on the open tab (leads with no follow-up last), most recently touched first elsewhere.
  const table = useClientTable<Lead>({
    rows,
    sortValues: {
      name: (l) => l.name,
      contact: (l) => l.phone,
      note: (l) => l.notes,
      when: (l) => (tab === 'open' ? l.followUpAt : l.updatedAt),
    },
    defaultSort: { id: 'when', dir: tab === 'open' ? 'asc' : 'desc' },
    deps: [tab, q],
  });
  const selection = useRowSelection<Lead>((l) => l.id, [tab, q]);

  async function runBulkArchive(action: 'archive' | 'restore') {
    setBulkBusy(true);
    setError(null);
    try {
      const result = await runBulk(selection.items, (l) => (action === 'archive' ? leadsApi.archive(l.id) : leadsApi.restore(l.id)));
      const text = bulkSummary(action === 'archive' ? 'Archived' : 'Restored', 'lead', result);
      if (result.failed.length === 0) toast.success(text);
      else setError(text);
      selection.replace(result.failed.map((f) => f.item)); // what failed stays ticked, to retry
      setBulkConfirm(null);
      setArchived(null);
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  function exportRows(list: Lead[]) {
    const head = ['Name', 'Company', 'Phone', 'Location', 'Stage', 'Follow-up', 'Expected value (KSh)', 'Notes'];
    downloadCsv(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      [head, ...list.map((l) => [l.name, l.company, l.phone, l.location, l.stage, l.followUpAt?.slice(0, 10), l.expectedValue, l.notes])],
    );
    toast.success(`Exported ${list.length} lead${list.length === 1 ? '' : 's'}`);
  }

  const columns: Column<Lead>[] = [
    {
      id: 'name',
      header: 'Lead',
      sortable: true,
      cell: (lead) => (
        <>
          <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {lead.name}
            {lead.convertedCustomerId && <span className="ml-2 text-xs font-medium" style={{ color: 'var(--color-status-ok)' }}>Converted</span>}
          </p>
          {lead.company && <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.company}</p>}
          {lead.expectedValue != null && <p className="text-xs data-num" style={{ color: 'var(--color-ink-600)' }}>KSh {fmtNumber(lead.expectedValue)}</p>}
        </>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      sortable: true,
      cell: (lead) => (
        <div style={{ color: 'var(--color-ink-600)' }}>
          {lead.phone ? (
            <div className="flex items-center gap-2">
              <a href={`tel:${lead.phone}`} className="hover:underline" style={{ color: 'var(--color-ink-900)' }}>{lead.phone}</a>
              <a href={waHref(lead.phone)} target="_blank" rel="noreferrer" title="Message on WhatsApp" aria-label={`Message ${lead.name} on WhatsApp`} className="flex h-7 w-7 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-ok)' }}>
                <MessageCircle size={13} strokeWidth={2} />
              </a>
            </div>
          ) : (
            '—'
          )}
          {lead.location && <p className="mt-0.5 flex items-center gap-1 text-xs"><MapPin size={11} strokeWidth={2} />{lead.location}</p>}
        </div>
      ),
    },
    {
      id: 'note',
      header: 'Note',
      sortable: true,
      hideBelow: 'lg',
      cell: (lead) => (
        <p className="max-w-xs truncate text-xs" title={lead.notes ?? undefined} style={{ color: 'var(--color-ink-600)' }}>
          {lead.notes || '—'}
        </p>
      ),
    },
    {
      id: 'when',
      header: tab === 'open' ? 'Follow-up' : 'Updated',
      sortable: true,
      defaultDir: tab === 'open' ? 'asc' : 'desc',
      cell: (lead) => {
        const fu = followUpInfo(lead.followUpAt);
        return (
          <span className="text-xs font-medium" style={{ color: tab === 'open' ? fu.color : 'var(--color-ink-600)' }}>
            {tab === 'open' ? fu.label : fmtDate(lead.updatedAt)}
          </span>
        );
      },
    },
  ];

  const actions = (lead: Lead): (RowAction | false)[] => [
    // Calling someone is what a lead is for, so contact comes first.
    !!lead.phone && { label: 'Call', icon: Phone, href: `tel:${lead.phone}`, hint: lead.phone },
    !!lead.phone && { label: 'WhatsApp', icon: MessageCircle, href: waHref(lead.phone), external: true },
    lead.stage === 'WON' && !lead.convertedCustomerId && { label: 'Convert to customer', icon: UserPlus, tone: 'accent', onClick: () => convert(lead) },
    { label: 'Edit lead', icon: Pencil, onClick: () => openEdit(lead) },
    tab === 'archived' ? { label: 'Restore', icon: RotateCcw, tone: 'accent', separatorBefore: true, onClick: () => restoreLead(lead) } : { label: 'Archive', icon: Archive, tone: 'danger', separatorBefore: true, onClick: () => archiveLead(lead) },
  ];

  const renderCard = (lead: Lead) => {
    const fu = followUpInfo(lead.followUpAt);
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {lead.name}
              {lead.convertedCustomerId && <span className="ml-2 text-xs font-medium" style={{ color: 'var(--color-status-ok)' }}>Converted</span>}
            </p>
            {lead.company && <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.company}</p>}
          </div>
          <p className="shrink-0 text-xs font-medium" style={{ color: tab === 'open' ? fu.color : 'var(--color-ink-600)' }}>
            {tab === 'open' ? fu.label : fmtDate(lead.updatedAt)}
          </p>
        </div>
        {lead.location && <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-ink-600)' }}><MapPin size={11} strokeWidth={2} />{lead.location}</p>}
        {lead.notes && <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.notes}</p>}
      </div>
    );
  };

  const buttonStyle = { borderColor: 'var(--color-border)', color: 'var(--color-ink-900)', backgroundColor: 'var(--color-surface)' };
  const bulkActions = (
    <>
      <button type="button" onClick={() => exportRows(selection.items)} className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium" style={buttonStyle}>
        <Download size={14} strokeWidth={2} />
        Export selected
      </button>
      <button
        type="button"
        onClick={() => setBulkConfirm(tab === 'archived' ? 'restore' : 'archive')}
        className="flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
        style={{ ...buttonStyle, color: tab === 'archived' ? 'var(--color-accent)' : 'var(--color-status-bad)' }}
      >
        {tab === 'archived' ? <RotateCcw size={14} strokeWidth={2} /> : <Archive size={14} strokeWidth={2} />}
        {tab === 'archived' ? 'Restore selected' : 'Archive selected'}
      </button>
    </>
  );

  const emptyState = (
    <>
      <Target size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
        {q ? 'No leads match your search' : tab === 'open' ? 'Nothing to follow up on' : tab === 'archived' ? 'No archived leads' : `No ${tab} leads yet`}
      </p>
      {!q && tab === 'open' && (
        <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Add a lead to start tracking who to call back.
        </p>
      )}
    </>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Leads
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            People to follow up with — sorted by who&apos;s due soonest.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          New lead
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            style={{
              borderColor: tab === t.key ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: tab === t.key ? 'var(--color-accent-soft)' : 'transparent',
              color: tab === t.key ? 'var(--color-accent)' : 'var(--color-ink-600)',
            }}
          >
            {t.label}
            {t.key === 'open' && overdueCount > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: 'var(--color-status-bad)' }}>
                {overdueCount} overdue
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <button type="button" onClick={() => setError(null)} className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </button>
      )}

      <div className="relative mt-3 max-w-sm">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
        <input
          type="search"
          aria-label="Search leads"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, location, note…"
          className="w-full rounded-md border py-2 pl-8 pr-9 text-sm outline-none focus:border-[var(--color-accent)] [&::-webkit-search-cancel-button]:hidden"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
        />
        {search && (
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md" style={{ color: 'var(--color-ink-600)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-5">
        <DataTable<Lead>
          {...table.tableProps}
          caption="Leads"
          columns={columns}
          rowKey={(l) => l.id}
          rowLabel={(l) => l.name}
          onRowClick={openEdit}
          actions={actions}
          renderCard={renderCard}
          selection={selection}
          bulkActions={bulkActions}
          empty={emptyState}
        />
      </div>

      <LeadFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { load(); setArchived(null); }} lead={editing} />

      {bulkConfirm && (
        <ConfirmDialog
          title={`${bulkConfirm === 'archive' ? 'Archive' : 'Restore'} ${selection.count} lead${selection.count === 1 ? '' : 's'}?`}
          description={bulkConfirm === 'archive' ? 'They leave the active list. They can be restored from the Archived tab any time.' : 'They return to the lists they were archived from.'}
          confirmLabel={bulkConfirm === 'archive' ? 'Archive' : 'Restore'}
          busy={bulkBusy}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => runBulkArchive(bulkConfirm)}
        />
      )}
    </div>
  );
}
