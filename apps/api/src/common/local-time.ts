/** The wall-clock date and time in the business's time zone. */
export function localNow(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

/** Milliseconds from `at` until the wall clock in `timeZone` next reads `hour`:00:00 (a full day if it is exactly that now). */
export function msUntilNextHour(timeZone: string, hour: number, at = new Date()): number {
  const t = localNow(timeZone, at);
  let secs = (hour - t.hour) * 3600 - t.minute * 60 - t.second;
  if (secs <= 0) secs += 86_400;
  return secs * 1000;
}
