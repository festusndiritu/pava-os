/** Runs one request per selected row, a few at a time, and reports which ones went through. */
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

export function bulkSummary(verb: string, noun: string, result: { done: unknown[]; failed: { message: string }[] }) {
  const ok = result.done.length;
  const bad = result.failed.length;
  const plural = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (bad === 0) return `${verb} ${plural(ok)}`;
  if (ok > 0) return `${verb} ${ok}, ${bad} failed`;
  return `${plural(bad)} failed: ${result.failed[0].message}`;
}
