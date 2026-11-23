import { api } from './api';

export type ReorderStatus = 'out' | 'reorder' | 'ok';

export interface ReorderBrandRow {
  productId: string;
  name: string;
  brand: string | null;
  onHand: number;
  soldInWindow: number;
  suggestedQty: number;
}

export interface ReorderItem {
  kind: 'product' | 'family';
  id: string;
  name: string;
  unit: string;
  onHand: number;
  dailyRate: number;
  daysLeft: number | null;
  reorderPoint: number;
  orderUpTo: number;
  suggestedQty: number;
  leadTimeDays: number;
  leadTimeOverridden: boolean;
  status: ReorderStatus;
  basis: 'sales' | 'slow' | 'threshold' | 'none';
  brands: ReorderBrandRow[];
}

export interface ReorderPlan {
  generatedAt: string;
  settings: { leadTimeDays: number; coverDays: number; serviceLevel: number };
  items: ReorderItem[];
}

export const reorderApi = {
  plan: (all = false) => api.get<ReorderPlan>(`/inventory/reorder${all ? '?all=1' : ''}`),
};
