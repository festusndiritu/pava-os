'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { usersApi, type StaffUser } from '../../../lib/users-api';
import { Avatar } from '../../../components/Avatar';
import { UserFormDrawer } from '../../../components/users/UserFormDrawer';
import { ResetPinDialog } from '../../../components/users/ResetPinDialog';

function fmtDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: active ? 'var(--color-status-okSoft)' : 'var(--color-status-badSoft)', color: active ? 'var(--color-status-ok)' : 'var(--color-status-bad)' }}
    >
      {active ? 'Active' : 'Deactivated'}
    </span>
  );
}

export default function UsersPage() {
  const { hasPermission, user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [resetPinFor, setResetPinFor] = useState<StaffUser | null>(null);

  async function load() {
    setUsers(await usersApi.list());
  }

  useEffect(() => {
    load();
  }, []);

  if (!hasPermission('USERS')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don't have access to this page.
        </p>
      </div>
    );
  }

  async function toggleActive(u: StaffUser) {
    if (u.id === currentUser?.id) return;
    await usersApi.update(u.id, { active: !u.active });
    load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Users &amp; Access
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-ink-600)' }}>
            Staff accounts, PINs, and module permissions.
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
          Add staff
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        {/* Desktop/tablet table */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Name
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Access
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Last active
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Created
              </th>
              <th className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink-600)' }}>
                Status
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users === null &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
                  </td>
                </tr>
              ))}

            {users?.map((u) => {
              const isAdmin = u.role === 'ADMIN';
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} avatar={u.avatar} size={32} />
                      <div>
                        <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
                          {u.name}
                          {isSelf && <span style={{ color: 'var(--color-ink-600)' }}> (you)</span>}
                        </p>
                        {u.phone && (
                          <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                            {u.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
                        <ShieldCheck size={13} strokeWidth={2} />
                        Administrator — full access
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-ink-600)' }}>{u.permissions.length} module{u.permissions.length === 1 ? '' : 's'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                    {fmtDate(u.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-ink-600)' }}>
                    {fmtDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={u.active} />
                  </td>
                  <td className="px-4 py-3">
                    {!isAdmin && (
                      <div className="flex items-center justify-end gap-3">
                        <button type="button" onClick={() => setResetPinFor(u)} className="text-xs font-medium" style={{ color: 'var(--color-ink-600)' }}>
                          Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(u);
                            setFormOpen(true);
                          }}
                          className="text-xs font-medium"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          disabled={isSelf}
                          className="text-xs font-medium disabled:opacity-40"
                          style={{ color: u.active ? 'var(--color-status-bad)' : 'var(--color-status-ok)' }}
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {users === null &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-2/3 animate-pulse rounded" style={{ backgroundColor: 'var(--color-border)' }} />
              </div>
            ))}
          {users?.length === 0 && (
            <div className="px-4 py-12 text-center">
              <UsersRound size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No staff accounts yet
              </p>
            </div>
          )}
          {users?.map((u) => {
            const isAdmin = u.role === 'ADMIN';
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} avatar={u.avatar} size={36} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                        {u.name}
                        {isSelf && <span style={{ color: 'var(--color-ink-600)' }}> (you)</span>}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                        {isAdmin ? 'Administrator' : `${u.permissions.length} module${u.permissions.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge active={u.active} />
                </div>
                {!isAdmin && (
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <button type="button" onClick={() => setResetPinFor(u)} className="flex items-center gap-1" style={{ color: 'var(--color-ink-600)' }}>
                      <KeyRound size={12} strokeWidth={2} />
                      Reset PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(u);
                        setFormOpen(true);
                      }}
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => toggleActive(u)} disabled={isSelf} className="disabled:opacity-40" style={{ color: u.active ? 'var(--color-status-bad)' : 'var(--color-status-ok)' }}>
                      {u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <UserFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} user={editing} />
      {resetPinFor && <ResetPinDialog user={resetPinFor} onClose={() => setResetPinFor(null)} onDone={() => setResetPinFor(null)} />}
    </div>
  );
}