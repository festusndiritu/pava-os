'use client';

// A tiny IndexedDB wrapper (no dependency). Two stores:
//   kv     - small named values (the cached catalogue, settings, a log of recent syncs)
//   outbox - sales rung up without internet, waiting to be sent. Keyed by the sale's clientId.

const DB_NAME = 'pava-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'clientId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(store: 'kv' | 'outbox', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        // Resolve on the transaction completing, not the request, so a write is durable when we return.
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const kvGet = <T>(key: string) => run<T | undefined>('kv', 'readonly', (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => run('kv', 'readwrite', (s) => s.put(value, key));
export const outboxAll = <T>() => run<T[]>('outbox', 'readonly', (s) => s.getAll());
export const outboxPut = <T extends { clientId: string }>(entry: T) => run('outbox', 'readwrite', (s) => s.put(entry));
export const outboxDelete = (clientId: string) => run('outbox', 'readwrite', (s) => s.delete(clientId));

/** Asks the browser not to evict our data under storage pressure. Best effort. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}
