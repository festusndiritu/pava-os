'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { usersApi, type StaffUser } from '../../../lib/users-api';
import { Avatar } from '../../../components/Avatar';
import { useClientTable } from '../../../lib/use-data-table';
import { DataTable, type Column } from '../../../components/ui/DataTable';
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

  // Administrators first, then by name; every column can be re-sorted.
  const table = useClientTable<StaffUser>({
    rows: users,
    sortValues: {
      name: (u) => u.name,
      access: (u) => (u.role === 'ADMIN' ? Number.MAX_SAFE_INTEGER : u.permissions.length),
      lastActive: (u) => u.lastLoginAt,
      created: (u) => u.createdAt,
      status: (u) => (u.active ? 0 : 1),
    },
    defaultSort: { id: 'name', dir: 'asc' },
  });

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

  const accessText = (u: StaffUser) => (u.role === 'ADMIN' ? 'Administrator' : `${u.permissions.length} module${u.permissions.length === 1 ? '' : 's'}`);

  const columns: Column<StaffUser>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={u.name} avatar={u.avatar} size={32} />
          <div>
            <p className="font-medium" style={{ color: 'var(--color-ink-900)' }}>
              {u.name}
              {u.id === currentUser?.id && <span style={{ color: 'var(--color-ink-600)' }}> (you)</span>}
            </p>
            {u.phone && (
              <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
                {u.phone}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'access',
      header: 'Access',
      sortable: true,
      defaultDir: 'desc',
      cell: (u) =>
        u.role === 'ADMIN' ? (
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
            <ShieldCheck size={13} strokeWidth={2} />
            Administrator — full access
          </span>
        ) : (
          <span style={{ color: 'var(--color-ink-600)' }}>{accessText(u)}</span>
        ),
    },
    { id: 'lastActive', header: 'Last active', label: 'Last active', sortable: true, defaultDir: 'desc', hideBelow: 'lg', cell: (u) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(u.lastLoginAt)}</span> },
    { id: 'created', header: 'Created', sortable: true, defaultDir: 'desc', hideBelow: 'xl', cell: (u) => <span style={{ color: 'var(--color-ink-600)' }}>{fmtDate(u.createdAt)}</span> },
    { id: 'status', header: 'Status', sortable: true, cell: (u) => <StatusBadge active={u.active} /> },
  ];

  // An administrator's account is managed elsewhere, so it has no actions here.
  const rowActions = (u: StaffUser) =>
    u.role === 'ADMIN' ? null : (
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
        <button type="button" onClick={() => setResetPinFor(u)} className="flex min-h-11 items-center gap-1 text-xs font-medium md:min-h-9" style={{ color: 'var(--color-ink-600)' }}>
          <KeyRound size={12} strokeWidth={2} />
          Reset PIN
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(u);
            setFormOpen(true);
          }}
          className="min-h-11 text-xs font-medium md:min-h-9"
          style={{ color: 'var(--color-accent)' }}
        >
          Edit
        </button>
        <button type="button" onClick={() => toggleActive(u)} disabled={u.id === currentUser?.id} className="min-h-11 text-xs font-medium disabled:opacity-40 md:min-h-9" style={{ color: u.active ? 'var(--color-status-bad)' : 'var(--color-status-ok)' }}>
          {u.active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    );

  const renderCard = (u: StaffUser) => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={u.name} avatar={u.avatar} size={36} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
            {u.name}
            {u.id === currentUser?.id && <span style={{ color: 'var(--color-ink-600)' }}> (you)</span>}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-ink-600)' }}>
            {accessText(u)}
          </p>
        </div>
      </div>
      <StatusBadge active={u.active} />
    </div>
  );

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

      <div className="mt-5">
        <DataTable<StaffUser>
          {...table.tableProps}
          caption="Staff accounts"
          columns={columns}
          rowKey={(u) => u.id}
          rowLabel={(u) => u.name}
          rowActions={rowActions}
          renderCard={renderCard}
          empty={
            <>
              <UsersRound size={28} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--color-ink-600)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                No staff accounts yet
              </p>
            </>
          }
        />
      </div>

      <UserFormDrawer open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} user={editing} />
      {resetPinFor && <ResetPinDialog user={resetPinFor} onClose={() => setResetPinFor(null)} onDone={() => setResetPinFor(null)} />}
    </div>
  );
}