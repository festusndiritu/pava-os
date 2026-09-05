'use client';

import { useAuth } from '../../../lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
        Dashboard
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
        Welcome back, {user.name}.
      </p>

      <div
        className="mt-6 rounded-lg border p-8 text-center"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          Sales performance, attention items, and the sales chart land here once the Dashboard module is built.
        </p>
      </div>
    </div>
  );
}