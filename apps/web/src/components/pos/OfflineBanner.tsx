'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { loadCatalogue, useOnline } from '../../lib/offline';
import { discardEntry, flushOutbox, retryEntry, useOutbox } from '../../lib/outbox';
import { money } from '../../lib/format';

/** Shows when the till is offline or sales are waiting to be sent, and lets the cashier see and retry them. */
export function OfflineBanner() {
  const { user } = useAuth();
  const online = useOnline();
  const { entries, synced } = useOutbox();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const read = () => void loadCatalogue().then((c) => setSavedAt(c?.savedAt ?? null));
    read();
    window.addEventListener('pava:catalogue-changed', read);
    return () => window.removeEventListener('pava:catalogue-changed', read);
  }, []);

  const pending = entries.filter((e) => e.status === 'pending');
  const failed = entries.filter((e) => e.status === 'failed');
  const mine = pending.filter((e) => e.userId === user?.id).length;
  const others = pending.length - mine;
  const lastDiffers = synced.find((s) => s.totalDiffers);
  if (online && entries.length === 0 && !lastDiffers) return null;

  const border = 'var(--color-border)';
  return (
    <div className="shrink-0 border-b px-3 py-2 text-xs" style={{ borderColor: border, backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-900)' }} role="status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!online && (
          <span className="flex items-center gap-1.5 font-semibold">
            <CloudOff size={14} strokeWidth={2} />
            Offline — prices{savedAt ? ` as of ${new Date(savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ' not saved on this device yet'}
          </span>
        )}
        {entries.length > 0 && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="underline">
            {pending.length > 0 && `${pending.length} sale${pending.length === 1 ? '' : 's'} waiting to send`}
            {pending.length > 0 && failed.length > 0 && ' · '}
            {failed.length > 0 && `${failed.length} need${failed.length === 1 ? 's' : ''} attention`}
          </button>
        )}
        {online && mine > 0 && (
          <button type="button" onClick={() => void flushOutbox(user?.id ?? null)} className="flex items-center gap-1 font-medium">
            <RefreshCw size={12} strokeWidth={2} /> Send now
          </button>
        )}
        {others > 0 && <span style={{ color: 'var(--color-ink-600)' }}>{others} more waiting for the person who rang them up to sign in</span>}
        {online && lastDiffers && entries.length === 0 && (
          <span>{lastDiffers.offlineNumber}: recorded total {money(lastDiffers.total)} differs from the receipt printed offline. Check it.</span>
        )}
      </div>

      {open && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {entries.map((e) => (
            <li key={e.clientId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5" style={{ borderColor: border }}>
              <span>
                <span className="data-num font-medium">{e.offlineNumber}</span> · {money(e.clientTotal)} · {new Date(e.occurredAt).toLocaleTimeString([], { timeStyle: 'short' })} · {e.userName}
                {e.status === 'failed' && <span className="block" style={{ color: 'var(--color-danger, #b42318)' }}>Not recorded: {e.error}</span>}
              </span>
              {e.status === 'failed' && (
                <span className="flex gap-3">
                  <button type="button" className="underline" onClick={() => void retryEntry(e.clientId, user?.id ?? null)}>
                    Retry
                  </button>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      if (window.confirm(`Discard ${e.offlineNumber}? It will never be recorded in the system.`)) void discardEntry(e.clientId);
                    }}
                  >
                    Discard
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
