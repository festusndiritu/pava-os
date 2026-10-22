/** Rounds a monetary amount to the nearest whole shilling using round-half- away-from-zero — PAVA prices in whole KES, no cents, so any arithmetic that derives a figure (a transport share, a discount, a FIFO-consumed cost, a payroll total) needs this pass before it's persisted or returned. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return value;
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}
