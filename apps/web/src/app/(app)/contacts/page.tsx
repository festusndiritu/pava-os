'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, UserSquare2 } from 'lucide-react';
import { contactsApi, type Contact } from '../../../lib/contacts-api';
import { ContactFormDrawer } from '../../../components/contacts/ContactFormDrawer';

const inputStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  async function load() {
    setContacts(await contactsApi.list(search || undefined));
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Contacts
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Suppliers, drivers, technicians — the operational phonebook.
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
          Add contact
        </button>
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-ink-600)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or role"
          className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
          style={inputStyle}
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Name</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Role</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Phone</th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>Tags</th>
            </tr>
          </thead>
          <tbody>
            {contacts === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}
            {contacts?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <UserSquare2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No contacts yet</p>
                </td>
              </tr>
            )}
            {contacts?.map((c) => (
              <tr key={c.id} onClick={() => { setEditing(c); setFormOpen(true); }} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--color-bg)]" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{c.name}</p>
                  {c.company && <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>{c.company}</p>}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>{c.role ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>{c.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-600)' }}>{t}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {contacts === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}
          {contacts?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <UserSquare2 size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>No contacts yet</p>
            </div>
          )}
          {contacts?.map((c) => (
            <button key={c.id} type="button" onClick={() => { setEditing(c); setFormOpen(true); }} className="flex w-full flex-col gap-1 p-4 text-left active:bg-[var(--color-bg)]">
              <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>{c.name}</p>
              <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>{[c.role, c.phone].filter(Boolean).join(' · ') || '—'}</p>
            </button>
          ))}
        </div>
      </div>

      <ContactFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} contact={editing} />
    </div>
  );
}