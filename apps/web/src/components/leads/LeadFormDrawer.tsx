'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { leadsApi, type Lead, type LeadStage } from '../../lib/leads-api';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_REQUIRED', 'QUOTE_SENT', 'NEGOTIATING', 'WON', 'LOST'];

export function LeadFormDrawer({ open, onClose, onSaved, lead }: { open: boolean; onClose: () => void; onSaved: () => void; lead: Lead | null }) {
  const isEdit = !!lead;
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [source, setSource] = useState('');
  const [stage, setStage] = useState<LeadStage>('NEW');
  const [expectedValue, setExpectedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? '');
    setCompany(lead?.company ?? '');
    setPhone(lead?.phone ?? '');
    setEmail(lead?.email ?? '');
    setLocation(lead?.location ?? '');
    setSource(lead?.source ?? '');
    setStage(lead?.stage ?? 'NEW');
    setExpectedValue(lead?.expectedValue != null ? String(lead.expectedValue) : '');
    setNotes(lead?.notes ?? '');
    setFollowUpAt(lead?.followUpAt ? lead.followUpAt.slice(0, 10) : '');
    setError(null);
  }, [open, lead]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        company: company || undefined,
        phone: phone || undefined,
        email: email || undefined,
        location: location || undefined,
        source: source || undefined,
        stage,
        expectedValue: expectedValue ? Number(expectedValue) : undefined,
        notes: notes || undefined,
        followUpAt: followUpAt || undefined,
      };
      if (isEdit && lead) await leadsApi.update(lead.id, payload);
      else await leadsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this lead.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit lead' : 'New lead'}
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="lead-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add lead'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className={labelClass} style={labelStyle}>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Source</label>
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Referral, Walk-in" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value as LeadStage)} className="w-full rounded-md border px-3 py-2 text-sm" style={inputStyle}>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Expected value (KSh)</label>
            <input type="number" min="0" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm data-num outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Follow-up date</label>
          <input type="date" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
      </form>
    </Drawer>
  );
}