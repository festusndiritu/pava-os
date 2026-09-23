/**
 * Rounds a monetary amount to the nearest whole shilling using round-half-
 * away-from-zero — PAVA prices in whole KES, no cents, so any arithmetic
 * that derives a figure (a transport share, a discount, a FIFO-consumed
 * cost, a payroll total) needs this pass before it's persisted or
 * returned. It also closes the ordinary float-drift hole: `0.1 + 0.2` is
 * `0.30000000000000004` in JS, and enough lines compound that into a
 * total that's off from what the lines actually say even when every
 * input was already a clean integer.
 *
 * Not a substitute for storing money as Decimal — see the schema note on
 * this — but it means every value that leaves this layer is a real whole
 * number, not one that merely displays as though it were.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return value;
  const rounded = Math.round(value);
  // Kill negative zero — "-0" is a surprising thing for a total that's
  // simply zero to print, and it compares unequal to 0 under Object.is.
  return rounded === 0 ? 0 : rounded;
}
