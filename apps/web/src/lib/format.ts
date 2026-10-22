export function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// One number format for the whole app.
const numberFormat = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

export function fmtNumber(n: number): string {
  return numberFormat.format(n);
}

export function money(n: number): string {
  return `KSh ${numberFormat.format(n)}`;
}
