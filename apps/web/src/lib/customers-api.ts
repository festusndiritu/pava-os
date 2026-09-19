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
  active: boolean;
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

export type CustomerStatus = 'active' | 'archived' | 'all';

export const customersApi = {
  list: (search?: string, status: CustomerStatus = 'active') => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    qs.set('status', status);
    return api.get<Customer[]>(`/customers?${qs.toString()}`);
  },
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/customers', data),
  update: (id: string, data: Partial<Customer>) => api.patch<Customer>(`/customers/${id}`, data),
  ledger: (id: string) => api.get<CustomerLedgerEntry[]>(`/customers/${id}/ledger`),
  recordPayment: (id: string, amount: number, note?: string) => api.post(`/customers/${id}/payments`, { amount, note }),
  adjustBalance: (id: string, amount: number, type: 'ADJUSTMENT' | 'OPENING' | 'REFUND' | 'WRITE_OFF', note?: string) =>
    api.post(`/customers/${id}/adjustments`, { amount, type, note }),
  // Soft delete — a customer's documents and ledger entries stay intact;
  // they just drop out of the active list and stop being offered at the till.
  archive: (id: string) => api.delete<Customer>(`/customers/${id}`),
  restore: (id: string) => api.post<Customer>(`/customers/${id}/restore`),
};