'use client';

import { useAuth } from '../../../lib/auth-context';

export default function PosPageStub() {
  const { hasPermission } = useAuth();

  if (!hasPermission('POS')) {
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
        POS
      </h1>
      <div
        className="mt-6 rounded-lg border p-8 text-center"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-ink-600)' }}>
          The sales terminal — search, cart, discounts, transport, payment, print — is its own build.
        </p>
      </div>
    </div>
  );
}