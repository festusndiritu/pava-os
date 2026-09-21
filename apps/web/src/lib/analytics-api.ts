import { api } from './api';

// A calendar range, inclusive at both ends, in the YYYY-MM-DD form the
// analytics controller parses. "to" is widened to end-of-day server-side
// (see parseRange), so a single-day range is from === to.
export interface DateRange {
  from: string;
  to: string;
}

export interface AnalyticsOverview {
  revenue: number;
  ordersCount: number;
  avgOrderValue: number;
  cogs: number;
  grossProfit: number;
  // Null when nothing sold in the range — a margin on zero revenue is not
  // 0%, it's undefined, and the service is careful to say so.
  marginPct: number | null;
  returnsTotal: number;
  returnsCount: number;
  chart: { date: string; total: number }[];
  previous?: {
    revenue: number;
    ordersCount: number;
    avgOrderValue: number;
    grossProfit: number;
  };
}

export interface CategorySalesRow {
  id: string;
  name: string;
  revenue: number;
  unitsSold: number;
}

export interface PaymentMixRow {
  method: string | null;
  total: number;
  count: number;
}

export interface TopProductRow {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface TopCustomerRow {
  id: string;
  name: string;
  revenue: number;
  orderCount: number;
}

export interface StaffPerformanceRow {
  id: string;
  name: string;
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
}

export interface InventorySnapshot {
  totalValue: number;
  // Units sitting in the yard with no recorded cost — they contribute
  // nothing to totalValue, so a large number here means the valuation is
  // understated and someone needs to back-fill costs.
  uncostedUnits: number;
  categories: { id: string; name: string; qty: number; value: number }[];
}

export interface ReturnRow {
  id: string;
  returnNumber: string;
  documentId: string;
  total: number;
  refundMethod: 'CASH' | 'MPESA' | null;
  reason: string | null;
  createdAt: string;
  createdBy: { name: string };
  document: { id: string; receiptNumber: string | null; invoiceNumber: string | null } | null;
  items: { id: string; description: string; qty: number; unitPrice: number; lineTotal: number }[];
}

function rangeQuery(range: DateRange, extra: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams({ from: range.from, to: range.to });
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  return `?${qs.toString()}`;
}

export const analyticsApi = {
  overview: (range: DateRange, compare = true) =>
    api.get<AnalyticsOverview>(`/analytics/overview${rangeQuery(range, { compare: compare ? undefined : 'false' })}`),
  salesByCategory: (range: DateRange) => api.get<CategorySalesRow[]>(`/analytics/sales-by-category${rangeQuery(range)}`),
  paymentMix: (range: DateRange) => api.get<PaymentMixRow[]>(`/analytics/payment-mix${rangeQuery(range)}`),
  topProducts: (range: DateRange, limit = 10) => api.get<TopProductRow[]>(`/analytics/top-products${rangeQuery(range, { limit })}`),
  topCustomers: (range: DateRange, limit = 10) => api.get<TopCustomerRow[]>(`/analytics/top-customers${rangeQuery(range, { limit })}`),
  staffPerformance: (range: DateRange) => api.get<StaffPerformanceRow[]>(`/analytics/staff-performance${rangeQuery(range)}`),
  // Deliberately range-free: what the yard holds right now, not over a period.
  inventorySnapshot: () => api.get<InventorySnapshot>('/analytics/inventory-snapshot'),
};

export const reportsApi = {
  returns: (limit = 200) => api.get<ReturnRow[]>(`/documents/returns/recent?limit=${limit}`),
};
