import { api } from './api';
import type { Product } from './products-api';
import type { Customer } from './customers-api';

export type DocumentType = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'DELIVERY_NOTE';
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
  quoteNumber: string | null;
  invoiceNumber: string | null;
  receiptNumber: string | null;
  deliveryNoteNumber: string | null;
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
  items: { productId?: string; description?: string; qty: number; unitPrice: number }[];
  transportAmount?: number;
  transportAllocation?: 'QUANTITY' | 'VALUE' | 'MANUAL';
  transportApplyTo?: string[];
  manualAllocations?: { productId: string; amount: number }[];
  foldTransportIntoPrices?: boolean;
  roundingIncrement?: number;
  notes?: string;
}

export const documentsApi = {
  list: (params: { status?: DocumentStatus; type?: DocumentType } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.type) qs.set('type', params.type);
    const s = qs.toString();
    return api.get<SaleDocument[]>(`/documents${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api.get<SaleDocument>(`/documents/${id}`),
  create: (data: CreateDocumentInput) => api.post<SaleDocument>('/documents', data),
  convertToInvoice: (id: string, allowNegativeStock?: boolean) => api.post<SaleDocument>(`/documents/${id}/convert-to-invoice`, { allowNegativeStock }),
  markPaid: (id: string) => api.post<SaleDocument>(`/documents/${id}/mark-paid`),
  cancel: (id: string) => api.post<SaleDocument>(`/documents/${id}/cancel`),
  createDeliveryNote: (id: string) => api.post<SaleDocument>(`/documents/${id}/delivery-note`),
};