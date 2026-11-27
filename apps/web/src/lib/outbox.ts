'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from './api';
import { isNetworkError } from './offline';
import { kvGet, kvSet, outboxAll, outboxDelete, outboxPut, requestPersistentStorage } from './offline-db';
import type { PosSaleInput, PosSaleResult } from './pos-api';

// Sales rung up while the till couldn't reach the server. Each one is written to the device first (so a
// closed tab, a flat battery or a crash can't lose it), a provisional receipt is printed, and it is sent
// when the connection is back. The server recognises a sale by its clientId, so sending it twice, or
// retrying after a timeout that actually went through, never records it twice.

export interface OutboxEntry {
  clientId: string;
  offlineNumber: string;
  occurredAt: string;
  userId: string;
  userName: string;
  input: PosSaleInput;
  /** What the provisional receipt said, so the figures match what was printed. */
  receipt: PosSaleResult;
  clientTotal: number;
  status: 'pending' | 'failed';
  error?: string;
  attempts: number;
}

export interface SyncedSale {
  offlineNumber: string;
  receiptNumber: string | null;
  total: number;
  at: string;
  /** The server worked out a different total from the one on the receipt printed offline. */
  totalDiffers: boolean;
}

const CHANGED = 'pava:outbox-changed';
// A plain flag the sign-in code can read synchronously: while sales are waiting, an idle sign-out must not strand them.
export const PENDING_FLAG = 'pava.pendingSales';
async function syncPendingFlag() {
  try {
    const waiting = (await listOutbox()).length > 0;
    if (waiting) localStorage.setItem(PENDING_FLAG, '1');
    else localStorage.removeItem(PENDING_FLAG);
  } catch {
    /* storage unavailable */
  }
}
const notify = () => {
  void syncPendingFlag();
  window.dispatchEvent(new Event(CHANGED));
};

export const listOutbox = async () => (await outboxAll<OutboxEntry>().catch(() => [])).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
export const listSynced = async () => (await kvGet<SyncedSale[]>('syncLog').catch(() => undefined)) ?? [];

// A short code per device keeps provisional numbers from the phone and the PC apart.
async function nextOfflineNumber(): Promise<string> {
  let tag = await kvGet<string>('deviceTag').catch(() => undefined);
  if (!tag) {
    tag = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 24]).join('');
    await kvSet('deviceTag', tag);
  }
  const n = ((await kvGet<number>('offlineSeq').catch(() => undefined)) ?? 0) + 1;
  await kvSet('offlineSeq', n);
  return `OFF-${tag}-${String(n).padStart(4, '0')}`;
}

export interface QueueSaleArgs {
  clientId: string;
  input: PosSaleInput;
  user: { id: string; name: string };
  buildReceipt: (offlineNumber: string, occurredAt: string) => PosSaleResult;
}

/** Saves the sale on the device and returns the provisional receipt to print. */
export async function queueSale({ clientId, input, user, buildReceipt }: QueueSaleArgs): Promise<PosSaleResult> {
  const offlineNumber = await nextOfflineNumber();
  const occurredAt = new Date().toISOString();
  const receipt = buildReceipt(offlineNumber, occurredAt);
  await outboxPut({
    clientId,
    offlineNumber,
    occurredAt,
    userId: user.id,
    userName: user.name,
    input,
    receipt,
    clientTotal: receipt.total,
    status: 'pending',
    attempts: 0,
  } satisfies OutboxEntry);
  void requestPersistentStorage();
  notify();
  return receipt;
}

let flushing = false;

/** Sends waiting sales, oldest first, for the signed-in user. Stops at the first sign the server is unreachable. */
export async function flushOutbox(currentUserId: string | null): Promise<number> {
  if (flushing || !currentUserId) return 0;
  flushing = true;
  let sent = 0;
  try {
    const run = async () => {
      for (const entry of await listOutbox()) {
        if (entry.status !== 'pending' || entry.userId !== currentUserId) continue;
        try {
          const saved = await api.post<PosSaleResult>('/documents/pos-sale', {
            ...entry.input,
            clientId: entry.clientId,
            offline: true,
            offlineNumber: entry.offlineNumber,
            occurredAt: entry.occurredAt,
            clientTotal: entry.clientTotal,
          });
          const log = await listSynced();
          await kvSet('syncLog', [{ offlineNumber: entry.offlineNumber, receiptNumber: saved.receiptNumber, total: saved.total, at: new Date().toISOString(), totalDiffers: saved.total !== entry.clientTotal }, ...log].slice(0, 30));
          await outboxDelete(entry.clientId);
          sent++;
          notify();
        } catch (err) {
          if (isNetworkError(err)) break; // still offline: leave everything where it is
          if (err instanceof ApiError && (err.status === 401 || err.status >= 500)) break; // sign in again / server trouble: try later
          // The server understood and refused it (e.g. a discount over the limit). Keep it, show why, never drop it.
          await outboxPut({ ...entry, status: 'failed', error: err instanceof Error ? err.message : 'Refused by the server', attempts: entry.attempts + 1 });
          notify();
        }
      }
    };
    // One tab at a time; the server's clientId check makes a rare overlap harmless anyway.
    if (navigator.locks?.request) await navigator.locks.request('pava-outbox-flush', run);
    else await run();
  } finally {
    flushing = false;
  }
  return sent;
}

export async function retryEntry(clientId: string, currentUserId: string | null) {
  const entry = (await listOutbox()).find((e) => e.clientId === clientId);
  if (entry) await outboxPut({ ...entry, status: 'pending', error: undefined });
  notify();
  await flushOutbox(currentUserId);
}

export async function discardEntry(clientId: string) {
  await outboxDelete(clientId);
  notify();
}

export function useOutbox() {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [synced, setSynced] = useState<SyncedSale[]>([]);
  const reload = useCallback(async () => {
    setEntries(await listOutbox());
    setSynced(await listSynced());
  }, []);
  useEffect(() => {
    void reload();
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [reload]);
  return { entries, synced, reload };
}
