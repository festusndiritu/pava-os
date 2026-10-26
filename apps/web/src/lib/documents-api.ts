import { api } from './api';
import type { Product } from './products-api';
import type { Customer } from './customers-api';
import type { PaymentLine } from './pos-api';

export type DocumentType = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'DELIVERY_NOTE';
export type DocumentStatus = 'DRAFT' | 'QUOTED' | 'INVOICED' | 'PAID' | 'CANCELLED' | 'SUSPENDED';
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
  /** How much of `qty` left the shop's own stock. Null = not recorded, read as all of it. */
  stockQty: number | null;
  /** Where the part that did not come from the shop is collected. */
  supplierSource: string | null;
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
  payments?: { id: string; method: string; amount: number }[];
  changeGiven?: number;
  changeToCredit?: number;
  creditApplied?: number;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  items: DocumentItem[];
  sourceDocumentId: string | null;
  sourceDocument: { id: string; receiptNumber: string | null; invoiceNumber: string | null; quoteNumber: string | null } | null;
  // DELIVERY_NOTE only — dispatch/site address, distinct from the customer's stored address.
  deliveryLocation: string | null;
  // DELIVERY_NOTE only — contact number for whoever's at the drop-off site.
  deliveryPhone: string | null;
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
  discount?: number;
  foldTransportIntoPrices?: boolean;
  roundingIncrement?: number;
  notes?: string;
}

/** Whether a quote can be edited in the quote form. */
export function canEditQuote(doc: Pick<SaleDocument, 'type' | 'status' | 'items'>): boolean {
  if (doc.type !== 'QUOTE' || doc.status !== 'QUOTED') return false;
  const ids = doc.items.map((i) => i.productId);
  return ids.length > 0 && ids.every((id): id is string => !!id) && new Set(ids).size === ids.length;
}

export interface DocumentListParams {
  status?: DocumentStatus | DocumentStatus[];
  type?: DocumentType;
  search?: string;
  from?: string;
  to?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

function documentQuery(params: DocumentListParams) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', Array.isArray(params.status) ? params.status.join(',') : params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.type) qs.set('type', params.type);
  if (params.search) qs.set('search', params.search);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.sort) qs.set('sort', params.sort);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export type EditRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface EditRequestInput {
  reason: string;
  items: { itemId?: string; productId?: string; description?: string; qty: number; unitPrice: number }[];
  transportAmount?: number;
  foldTransportIntoPrices?: boolean;
}

export interface EditRequest {
  id: string;
  documentId: string;
  status: EditRequestStatus;
  reason: string;
  changes: EditRequestInput & {
    before?: { description: string; qty: number; unitPrice: number; lineTotal: number }[];
    before_transport?: number;
    after?: { description: string; qty: number; unitPrice: number; lineTotal: number }[];
  };
  previousTotal: number;
  proposedTotal: number;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy?: { name: string };
  decidedBy?: { name: string } | null;
  document?: {
    id: string;
    type: string;
    status: string;
    invoiceNumber: string | null;
    receiptNumber: string | null;
    customerName: string | null;
    customer: { name: string; businessName: string | null } | null;
  };
}

export const documentsApi = {
  // `from`/`to` are YYYY-MM-DD calendar days, inclusive at both ends — the backend widens `to` to
  // the end of that day.
  list: (params: DocumentListParams = {}) => api.get<SaleDocument[]>(`/documents${documentQuery(params)}`),
  listPage: (params: DocumentListParams = {}) => api.getPage<SaleDocument>(`/documents${documentQuery(params)}`),
  get: (id: string) => api.get<SaleDocument>(`/documents/${id}`),
  create: (data: CreateDocumentInput) => api.post<SaleDocument>('/documents', data),
  update: (id: string, data: CreateDocumentInput) => api.patch<SaleDocument>(`/documents/${id}`, data),
  convertToInvoice: (id: string, opts: { allowNegativeStock?: boolean; fulfilment?: { itemId: string; stockQty: number; supplierSource?: string }[] } = {}) =>
    api.post<SaleDocument>(`/documents/${id}/convert-to-invoice`, opts),
  markPaid: (id: string, opts: { paymentMethod?: 'CASH' | 'MPESA'; payments?: PaymentLine[]; changeAction?: 'GIVE' | 'CREDIT'; discount?: number } = {}) =>
    api.post<SaleDocument>(`/documents/${id}/mark-paid`, opts),
  // Only a cancelled quote that was never invoiced can be deleted.
  deleteQuote: (id: string) => api.delete<{ id: string }>(`/documents/${id}`),
  requestEdit: (id: string, data: EditRequestInput) => api.post<EditRequest>(`/documents/${id}/edit-requests`, data),
  editRequestsFor: (id: string) => api.get<EditRequest[]>(`/documents/${id}/edit-requests`),
  listEditRequests: (status?: EditRequestStatus) => api.get<EditRequest[]>(`/documents/edit-requests${status ? `?status=${status}` : ''}`),
  approveEdit: (requestId: string, opts: { note?: string; settlement?: 'CASH' | 'MPESA' | 'CREDIT' } = {}) =>
    api.post<SaleDocument>(`/documents/edit-requests/${requestId}/approve`, opts),
  rejectEdit: (requestId: string, opts: { note?: string } = {}) => api.post<EditRequest>(`/documents/edit-requests/${requestId}/reject`, opts),
  cancel: (id: string) => api.post<SaleDocument>(`/documents/${id}/cancel`),
};