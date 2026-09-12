'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { contactsApi, type Contact } from '../../lib/contacts-api';
import { ApiError } from '../../lib/api';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-900)' };
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase';
const labelStyle = { color: 'var(--color-ink-600)', letterSpacing: '0.06em' };

export function ContactFormDrawer({ open, onClose, onSaved, contact }: { open: boolean; onClose: () => void; onSaved: () => void; contact: Contact | null }) {
  const isEdit = !!contact;
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? '');
    setCompany(contact?.company ?? '');
    setRole(contact?.role ?? '');
    setPhone(contact?.phone ?? '');
    setAltPhone(contact?.altPhone ?? '');
    setNotes(contact?.notes ?? '');
    setTags(contact?.tags.join(', ') ?? '');
    setFollowUpAt(contact?.followUpAt ? contact.followUpAt.slice(0, 10) : '');
    setError(null);
  }, [open, contact]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        company: company || undefined,
        role: role || undefined,
        phone: phone || undefined,
        altPhone: altPhone || undefined,
        notes: notes || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        followUpAt: followUpAt || undefined,
      };
      if (isEdit && contact) await contactsApi.update(contact.id, payload);
      else await contactsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit contact' : 'New contact'}
      footer={
        <div className="flex items-center gap-3">
          <button type="submit" form="contact-form" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add contact'}
          </button>
          {error && (
            <span className="text-sm" style={{ color: 'var(--color-status-bad)' }}>
              {error}
            </span>
          )}
        </div>
      }
    >
      <form id="contact-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className={labelClass} style={labelStyle}>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Company</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Role / type</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Supplier, Driver, Technician" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={labelStyle}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Alternate phone</label>
            <input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. reliable, cash-only" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" style={inputStyle} />
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