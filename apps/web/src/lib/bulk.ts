/**
 * Runs one request per selected row, a few at a time, and reports which ones
 * went through. Used for bulk actions on top of the existing single-record
 * endpoints: a failure on one row never stops the others, and the caller can
 * say exactly what happened ("Archived 18, 2 failed") instead of all-or-nothing.
 */
export async function runBulk<T>(items: T[], task: (item: T) => Promise<unknown>, concurrency = 4): Promise<{ done: T[]; failed: { item: T; message: string }[] }> {
  const done: T[] = [];
  const failed: { item: T; message: string }[] = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
        done.push(item);
      } catch (err) {
        failed.push({ item, message: err instanceof Error ? err.message : 'Failed' });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { done, failed };
}

/** "Archived 18 products. 2 failed: …" — one sentence for a toast or banner. */
export function bulkSummary(verb: string, noun: string, result: { done: unknown[]; failed: { message: string }[] }) {
  const ok = result.done.length;
  const plural = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (result.failed.length === 0) return `${verb} ${plural(ok)}.`;
  const first = result.failed[0].message;
  return `${ok > 0 ? `${verb} ${plural(ok)}. ` : ''}${result.failed.length} failed: ${first}${result.failed.length > 1 ? ' (and others)' : ''}`;
}
