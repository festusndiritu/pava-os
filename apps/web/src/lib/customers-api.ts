import { api } from './api';

export interface Customer {
  id: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  altPhone: string | null;
  location: string | null;
  address: string | null;
  notes: string | null;
  isCredit: boolean;
  creditLimit: number | null;
  creditBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEntryType = 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT' | 'OPENING' | 'REFUND' | 'WRITE_OFF';

export interface CustomerLedgerEntry {
  id: string;
  type: LedgerEntryType;
  amount: number;
  note: string | null;
  documentId: string | null;
  createdAt: string;
  createdBy: { name: string };
}

export const customersApi = {
  list: (search?: string) => api.get<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/customers', data),
  update: (id: string, data: Partial<Customer>) => api.patch<Customer>(`/customers/${id}`, data),
  ledger: (id: string) => api.get<CustomerLedgerEntry[]>(`/customers/${id}/ledger`),
  recordPayment: (id: string, amount: number, note?: string) => api.post(`/customers/${id}/payments`, { amount, note }),
  adjustBalance: (id: string, amount: number, type: 'ADJUSTMENT' | 'OPENING' | 'REFUND' | 'WRITE_OFF', note?: string) =>
    api.post(`/customers/${id}/adjustments`, { amount, type, note }),
};