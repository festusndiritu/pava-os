// The reorder maths, kept free of the database so it can be reasoned about (and tested) on its own.
//
// For one product — or one family pooled across its brands — we look at how many units sold on each
// day lately, and work out:
//   reorder point  = average daily sales × lead time  +  a safety buffer
//   order up to    = average daily sales × (lead time + cover days)  +  the same buffer
// Reorder when stock is at or below the reorder point; the suggestion tops it back up to "order up
// to". The buffer is sized from how erratic the daily sales are and how sure we want to be of not
// running out (the service level), so steady sellers get a thin buffer and lumpy ones a thicker one.

export type ReorderBasis = 'sales' | 'slow' | 'threshold' | 'none';
export type ReorderStatus = 'out' | 'reorder' | 'ok';

export interface ForecastInput {
  /** Units sold (net of returns) on each day that counts, oldest to newest. */
  daily: number[];
  onHand: number;
  leadDays: number;
  coverDays: number;
  /** Standard-normal z for the wanted service level. */
  z: number;
  /** Used only for items that are new and have not sold yet: the shop's old fixed threshold. */
  fallbackPoint: number;
  /** True for an item too new to have a sales record worth judging. */
  isNew: boolean;
}

export interface Forecast {
  dailyRate: number;
  reorderPoint: number;
  orderUpTo: number;
  suggestedQty: number;
  daysLeft: number | null;
  status: ReorderStatus;
  basis: ReorderBasis;
}

/** Fewer sale-days than this and the daily swings say nothing reliable, so no safety buffer. */
export const SLOW_SELLER_DAYS = 5;

/** z for a service level given as a percentage (Acklam-style rational approximation, accurate to ~1e-4). */
export function zForServiceLevel(percent: number): number {
  const p = Math.min(0.999, Math.max(0.5, percent / 100));
  // Abramowitz & Stegun 26.2.23
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  return t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
}

export function forecast(input: ForecastInput): Forecast {
  const { daily, onHand, leadDays, coverDays, z, fallbackPoint, isNew } = input;
  const n = daily.length;
  const total = daily.reduce((a, b) => a + b, 0);

  let basis: ReorderBasis;
  let dailyRate = 0;
  let reorderPoint = 0;
  let orderUpTo = 0;

  if (n === 0 || total <= 0) {
    // Nothing has sold. A brand-new item keeps the old fixed threshold until it has a record; an
    // established one that has stopped selling is left alone (no point restocking dead stock).
    if (isNew && fallbackPoint > 0) {
      basis = 'threshold';
      reorderPoint = fallbackPoint;
      orderUpTo = fallbackPoint * 2;
    } else {
      basis = 'none';
    }
  } else {
    dailyRate = total / n;
    const saleDays = daily.filter((x) => x > 0).length;
    if (saleDays < SLOW_SELLER_DAYS) {
      basis = 'slow';
      reorderPoint = Math.max(1, Math.ceil(dailyRate * leadDays));
      orderUpTo = Math.max(reorderPoint + 1, Math.ceil(dailyRate * (leadDays + coverDays)));
    } else {
      basis = 'sales';
      const variance = n > 1 ? daily.reduce((a, x) => a + (x - dailyRate) ** 2, 0) / (n - 1) : 0;
      const buffer = z * Math.sqrt(variance) * Math.sqrt(leadDays);
      reorderPoint = Math.max(1, Math.ceil(dailyRate * leadDays + buffer));
      orderUpTo = Math.max(reorderPoint + 1, Math.ceil(dailyRate * (leadDays + coverDays) + buffer));
    }
  }

  let status: ReorderStatus = 'ok';
  if (basis !== 'none') {
    if (onHand <= 0) status = 'out';
    else if (onHand <= reorderPoint) status = 'reorder';
  }

  return {
    dailyRate,
    reorderPoint,
    orderUpTo,
    suggestedQty: status === 'ok' ? 0 : Math.max(1, orderUpTo - Math.max(0, onHand)),
    daysLeft: dailyRate > 0 ? Math.max(0, onHand) / dailyRate : null,
    status,
    basis,
  };
}

/** Shares a quantity out in proportion to weights, in whole units, with no unit lost or invented. */
export function splitByWeight(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}
