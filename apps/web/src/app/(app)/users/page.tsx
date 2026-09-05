'use client';

import { useAuth } from '../../../lib/auth-context';

export default function UsersPageStub() {
  const { hasPermission } = useAuth();

  if (!hasPermission('USERS')) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You don't have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
        Users &amp; Access
      </h1>
      <div
        className="mt-6 rounded-lg border p-8 text-center"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Staff list, permission editor and PIN reset land here next.
        </p>
      </div>
    </div>
  );
}