'use client';

import { useEffect, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { leadsApi, type Lead, type LeadStage } from '../../../lib/leads-api';
import { LeadFormDrawer } from '../../../components/leads/LeadFormDrawer';
import { ApiError } from '../../../lib/api';

const STAGES: { key: LeadStage; label: string }[] = [
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'QUALIFIED', label: 'Qualified' },
  { key: 'QUOTE_REQUIRED', label: 'Quote Required' },
  { key: 'QUOTE_SENT', label: 'Quote Sent' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'WON', label: 'Won' },
  { key: 'LOST', label: 'Lost' },
];

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLeads(await leadsApi.list());
  }

  useEffect(() => {
    load();
  }, []);

  async function moveStage(lead: Lead, stage: LeadStage) {
    await leadsApi.update(lead.id, { stage });
    load();
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

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Leads
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Potential business, tracked from first contact to close.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus size={15} strokeWidth={2} />
          New lead
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}>
          {error}
        </p>
      )}

      {leads === null ? (
        <div className="mt-6 flex gap-4 overflow-x-auto">
          {STAGES.map((s) => (
            <div key={s.key} className="h-40 w-64 shrink-0 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-border)' }} />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="mt-6 flex flex-1 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="text-center">
            <Target size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No leads yet</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>Add a lead to start tracking potential business.</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-1 gap-4 overflow-x-auto pb-2">
          {STAGES.map((col) => {
            const items = leads.filter((l) => l.stage === col.key);
            return (
              <div key={col.key} className="flex w-72 shrink-0 flex-col rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-ink-600)', letterSpacing: '0.04em' }}>
                    {col.label}
                  </p>
                  <span className="text-xs" style={{ color: 'var(--color-ink-600)' }}>{items.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {items.map((lead) => {
                    const overdue = lead.followUpAt && new Date(lead.followUpAt) < new Date() && lead.stage !== 'WON' && lead.stage !== 'LOST';
                    return (
                      <div
                        key={lead.id}
                        className="rounded-md border p-3"
                        style={{ borderColor: overdue ? 'var(--color-status-bad)' : 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(lead);
                            setFormOpen(true);
                          }}
                          className="block w-full text-left"
                        >
                          <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>{lead.name}</p>
                          {lead.company && (
                            <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>{lead.company}</p>
                          )}
                          {lead.expectedValue != null && (
                            <p className="mt-1 text-xs font-medium data-num" style={{ color: 'var(--color-ink-900)' }}>
                              KSh {lead.expectedValue.toLocaleString()}
                            </p>
                          )}
                          {lead.followUpAt && (
                            <p className="mt-1 text-xs" style={{ color: overdue ? 'var(--color-status-bad)' : 'var(--color-ink-600)' }}>
                              Follow up {fmtDate(lead.followUpAt)}
                            </p>
                          )}
                        </button>
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={lead.stage}
                            onChange={(e) => moveStage(lead, e.target.value as LeadStage)}
                            className="flex-1 rounded border px-1.5 py-1 text-xs"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' }}
                          >
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                          {lead.stage === 'WON' && !lead.convertedCustomerId && (
                            <button type="button" onClick={() => convert(lead)} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
                              To customer
                            </button>
                          )}
                          {lead.convertedCustomerId && (
                            <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--color-status-ok)' }}>
                              Converted
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} lead={editing} />
    </div>
  );
}