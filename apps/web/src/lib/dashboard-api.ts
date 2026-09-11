import { api } from './api';

export interface DashboardSummary {
  sales?: {
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
  };
  chart?: { date: string; total: number }[];
  recentSales?: { id: string; customerLabel: string; total: number; status: string; paymentMethod: string | null; createdAt: string }[];
  lowStock?: { id: string; name: string; stockQuantity: number; unit: string }[];
  outstandingCredit?: {
    total: number;
    customerCount: number;
    topDebtors: { id: string; name: string; balance: number; overLimit: boolean }[];
  };
  topProducts?: { id: string; name: string; unitsSold: number; revenue: number }[];
}

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
};