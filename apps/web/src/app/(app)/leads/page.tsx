'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, MapPin, MessageCircle, Pencil, Phone, Plus, RotateCcw, Search, Target } from 'lucide-react';
import { leadsApi, type Lead } from '../../../lib/leads-api';
import { LeadFormDrawer } from '../../../components/leads/LeadFormDrawer';
import { ApiError } from '../../../lib/api';
import { fmtNumber } from '../../../lib/format';
import { activateOnKey } from '../../../lib/a11y';

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

function byFollowUpSoonest(a: Lead, b: Lead) {
  if (!a.followUpAt && !b.followUpAt) return 0;
  if (!a.followUpAt) return 1;
  if (!b.followUpAt) return -1;
  return new Date(a.followUpAt).getTime() - new Date(b.followUpAt).getTime();
}

function byRecentlyUpdated(a: Lead, b: Lead) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function waHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `254${digits.slice(1)}` : digits}`;
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
    return [...filtered].sort(tab === 'open' ? byFollowUpSoonest : byRecentlyUpdated);
  }, [tab, leads, archived, q]);

  const overdueCount = leads?.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST' && l.followUpAt && new Date(l.followUpAt) < new Date()).length ?? 0;

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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, location, note…"
          className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop/tablet */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Lead</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Contact</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Note</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>{tab === 'open' ? 'Follow-up' : 'Updated'}</th>
              <th className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--color-ink-600)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Target size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                    {tab === 'open' ? 'Nothing to follow up on' : tab === 'archived' ? 'No archived leads' : `No ${tab} leads yet`}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
                    {tab === 'open' ? 'Add a lead to start tracking who to call back.' : ' '}
                  </p>
                </td>
              </tr>
            )}

            {rows?.map((lead) => {
              const fu = followUpInfo(lead.followUpAt);
              return (
                <tr key={lead.id} onClick={() => openEdit(lead)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{lead.name}</p>
                    {lead.company && <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.company}</p>}
                    {lead.expectedValue != null && (
                      <p className="text-xs data-num" style={{ color: 'var(--color-ink-600)' }}>KSh {fmtNumber(lead.expectedValue)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }} onClick={(e) => e.stopPropagation()}>
                    {lead.phone ? (
                      <div className="flex items-center gap-2">
                        <a href={`tel:${lead.phone}`} className="hover:underline" style={{ color: 'var(--color-ink-900)' }}>{lead.phone}</a>
                        <a href={waHref(lead.phone)} target="_blank" rel="noreferrer" title="Message on WhatsApp" className="flex h-7 w-7 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-ok)' }}>
                          <MessageCircle size={13} strokeWidth={2} />
                        </a>
                      </div>
                    ) : (
                      '—'
                    )}
                    {lead.location && <p className="mt-0.5 flex items-center gap-1 text-xs"><MapPin size={11} strokeWidth={2} />{lead.location}</p>}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate text-xs" title={lead.notes ?? undefined} style={{ color: 'var(--color-ink-600)' }}>
                      {lead.notes || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: tab === 'open' ? fu.color : 'var(--color-ink-600)' }}>
                    {tab === 'open' ? fu.label : fmtDate(lead.updatedAt)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {lead.stage === 'WON' && !lead.convertedCustomerId && (
                        <button type="button" onClick={() => convert(lead)} className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
                          To customer
                        </button>
                      )}
                      {lead.convertedCustomerId && (
                        <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--color-status-ok)' }}>Converted</span>
                      )}
                      <button type="button" title="Edit lead" aria-label="Edit lead" onClick={() => openEdit(lead)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-600)' }}>
                        <Pencil size={15} strokeWidth={2} />
                      </button>
                      {tab === 'archived' ? (
                        <button type="button" title="Restore lead" aria-label="Restore lead" onClick={() => restoreLead(lead)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>
                          <RotateCcw size={15} strokeWidth={2} />
                        </button>
                      ) : (
                        <button type="button" title="Archive lead" aria-label="Archive lead" onClick={() => archiveLead(lead)} className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                          <Archive size={15} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile */}
        <div className="divide-y divide-[var(--color-border)] md:hidden">
          {rows === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}

          {rows?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Target size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {tab === 'open' ? 'Nothing to follow up on' : tab === 'archived' ? 'No archived leads' : `No ${tab} leads yet`}
              </p>
            </div>
          )}

          {rows?.map((lead) => {
            const fu = followUpInfo(lead.followUpAt);
            return (
              <div key={lead.id} className="flex flex-col gap-1.5 p-4">
                <div onClick={() => openEdit(lead)} onKeyDown={activateOnKey(() => openEdit(lead))} tabIndex={0} role="button" className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium" style={{ color: 'var(--color-ink-900)' }}>{lead.name}</p>
                    {lead.company && <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.company}</p>}
                  </div>
                  <p className="shrink-0 text-xs font-medium" style={{ color: tab === 'open' ? fu.color : 'var(--color-ink-600)' }}>
                    {tab === 'open' ? fu.label : fmtDate(lead.updatedAt)}
                  </p>
                </div>

                {lead.location && <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-ink-600)' }}><MapPin size={11} strokeWidth={2} />{lead.location}</p>}
                {lead.notes && <p className="truncate text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.notes}</p>}

                <div className="mt-1 flex items-center gap-2">
                  {lead.phone && (
                    <>
                      <a href={`tel:${lead.phone}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}>
                        <Phone size={13} strokeWidth={2} /> Call
                      </a>
                      <a href={waHref(lead.phone)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-ok)' }}>
                        <MessageCircle size={13} strokeWidth={2} /> WhatsApp
                      </a>
                    </>
                  )}
                  {lead.stage === 'WON' && !lead.convertedCustomerId && (
                    <button type="button" onClick={() => convert(lead)} className="shrink-0 rounded-md px-3 py-2 text-xs font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
                      To customer
                    </button>
                  )}
                  {tab === 'archived' ? (
                    <button type="button" aria-label="Restore lead" onClick={() => restoreLead(lead)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>
                      <RotateCcw size={15} strokeWidth={2} />
                    </button>
                  ) : (
                    <button type="button" aria-label="Archive lead" onClick={() => archiveLead(lead)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-bad)' }}>
                      <Archive size={15} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LeadFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => { load(); setArchived(null); }} lead={editing} />
    </div>
  );
}
