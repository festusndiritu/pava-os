/**
 * Today's date as YYYY-MM-DD in the browser's local time zone. Not
 * `new Date().toISOString().slice(0, 10)`, which is the UTC date — in Nairobi
 * (UTC+3) that reports yesterday between midnight and 3am.
 */
export function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
