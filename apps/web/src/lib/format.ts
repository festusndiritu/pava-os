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

// One number format for the whole app. `toLocaleString()` with no locale uses
// whatever the device is set to, so the same invoice could read "102,600",
// "102.600" or "102 600" depending on the phone — and the WhatsApp price list
// is shared text that has to read the same for everyone. Kenya's convention:
// comma thousands, no decimals (all money is whole shillings).
const numberFormat = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

/** 102600 → "102,600" */
export function fmtNumber(n: number): string {
  return numberFormat.format(n);
}

/** 102600 → "KSh 102,600" */
export function money(n: number): string {
  return `KSh ${numberFormat.format(n)}`;
}
