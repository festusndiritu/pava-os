import { api } from './api';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'PAID';
export type PaymentMethod = 'CASH' | 'MPESA' | 'CARD' | 'CREDIT';

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  categoryId: string | null;
  category: ExpenseCategory | null;
  amount: number;
  date: string;
  description: string | null;
  vendor: string | null;
  paymentMethod: PaymentMethod | null;
  reference: string | null;
  status: ExpenseStatus;
  notes: string | null;
  createdAt: string;
  createdBy: { name: string };
}

export const expensesApi = {
  categories: () => api.get<ExpenseCategory[]>('/expenses/categories'),
  list: (params?: { from?: string; to?: string; categoryId?: string; status?: ExpenseStatus }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return api.get<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`);
  },
  create: (data: Partial<Expense> & { categoryName?: string }) => api.post<Expense>('/expenses', data),
  update: (id: string, data: Partial<Expense>) => api.patch<Expense>(`/expenses/${id}`, data),
};