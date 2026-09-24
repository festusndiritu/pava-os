'use client';

import { Clock } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { Modal } from '../ui/Modal';

export function IdleWarningDialog() {
  const { idleWarning, dismissIdleWarning, logout } = useAuth();

  if (!idleWarning) return null;

  return (
    // Escape means "keep me signed in", never "sign out".
    <Modal onClose={dismissIdleWarning} role="alertdialog" placement="center" dismissOnBackdrop={false} labelledBy="idle-warning-title" className="max-w-sm p-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--color-status-warnSoft)', color: 'var(--color-status-warn)' }}
        >
          <Clock size={18} strokeWidth={2} />
        </div>
        <h2 id="idle-warning-title" className="mt-3 text-sm font-semibold" style={{ color: 'var(--color-ink-900)' }}>
          You'll be signed out soon
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-600)' }}>
          You've been inactive for a while. For security, you'll be signed out automatically unless you continue.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => logout()}
            className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink-900)' }}
          >
            Sign out now
          </button>
          <button
            type="button"
            onClick={dismissIdleWarning}
            className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Continue session
          </button>
        </div>
    </Modal>
  );
}