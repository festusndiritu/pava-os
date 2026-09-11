import { api } from './api';
import type { Product } from './products-api';
import type { Customer } from './customers-api';

export type DocumentType = 'QUOTE' | 'INVOICE' | 'RECEIPT';
export type DocumentStatus = 'DRAFT' | 'QUOTED' | 'INVOICED' | 'PAID' | 'CANCELLED';
export type TransportMode = 'NONE' | 'ITEMIZED' | 'DISTRIBUTED';

export interface DocumentItem {
  id: string;
  productId: string | null;
  product: Product | null;
  description: string;
  qty: number;
  basePrice: number;
  unitPrice: number;
  discount: number;
  transportAllocated: number;
  roundingAdjustment: number;
  lineTotal: number;
}

export interface SaleDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  customerId: string | null;
  customerName: string | null;
  customer: Customer | null;
  createdBy: { name: string };
  transportMode: TransportMode;
  transportAmount: number;
  roundingAdjustment: number;
  paymentMethod: string | null;
  subtotal: number;
  total: number;
  notes: string | null;
  items: DocumentItem[];
  invoicedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CreateDocumentInput {
  customerId?: string;
  customerName?: string;
  items: { productId?: string; description: string; qty: number; unitPrice: number; discount?: number }[];
  transportMode?: TransportMode;
  transportAmount?: number;
  notes?: string;
}

export const documentsApi = {
  list: (params: { status?: DocumentStatus } = {}) => {
    const qs = params.status ? `?status=${params.status}` : '';
    return api.get<SaleDocument[]>(`/documents${qs}`);
  },
  get: (id: string) => api.get<SaleDocument>(`/documents/${id}`),
  create: (data: CreateDocumentInput) => api.post<SaleDocument>('/documents', data),
  convertToInvoice: (id: string) => api.post<SaleDocument>(`/documents/${id}/convert-to-invoice`),
  markPaid: (id: string) => api.post<SaleDocument>(`/documents/${id}/mark-paid`),
  cancel: (id: string) => api.post<SaleDocument>(`/documents/${id}/cancel`),
};