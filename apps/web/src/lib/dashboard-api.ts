import { api } from './api';

export interface DashboardSummary {
  sales?: {
    today: {
      total: number;
      count: number;
    };
    week: {
      total: number;
      count: number;
    };
    month: {
      total: number;
      count: number;
    };
  };

  /** Daily paid totals, oldest first, ending with today (business calendar). */
  chart?: {
    date: string;
    total: number;
  }[];

  /** Open (invoiced, unpaid) documents — the true count and value. */
  unpaid?: {
    count: number;
    total: number;
  };

  /** Payment split of paid sales over the last 30 days. */
  paymentMix?: {
    method: string;
    count: number;
    total: number;
  }[];

  recentSales?: {
    id: string;
    customerLabel: string;
    total: number;
    status: string;
    paymentMethod: string | null;
    createdAt: string;
  }[];

  lowStock?: {
    id: string;
    name: string;
    stockQuantity: number;
    unit: string;
    threshold: number;
    kind: 'product' | 'family';
  }[];

  lowStockCount?: number;
  outOfStockCount?: number;

  outstandingCredit?: {
    total: number;
    customerCount: number;
    topDebtors: {
      id: string;
      name: string;
      balance: number;
      overLimit: boolean;
    }[];
  };

  topProducts?: {
    id: string;
    name: string;
    unitsSold: number;
    revenue: number;
  }[];
}

export const dashboardApi = {
  summary: () =>
    api.get<DashboardSummary>('/dashboard/summary'),
};