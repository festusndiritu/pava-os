import { api } from './api';
import type { Product } from './products-api';

// The till takes M-Pesa Paybill (the default) and cash. Account sales go
// through the quote -> invoice flow, not the POS.
export type PosPaymentMethod = 'MPESA' | 'CASH';

export const POS_PAYMENT_METHODS: { value: PosPaymentMethod; label: string; hint: string }[] = [
  { value: 'MPESA', label: 'M-Pesa', hint: 'Paybill' },
  { value: 'CASH', label: 'Cash', hint: 'At the counter' },
];
export type TransportAllocation = 'QUANTITY' | 'VALUE' | 'MANUAL';

export interface PosCartItemInput {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface PosSaleInput {
  /** Goods out now, settled the same day — raised as an unpaid invoice. */
  settleLater?: boolean;
  customerId?: string;
  customerName?: string;
  items: PosCartItemInput[];
  transportAmount?: number;
  transportAllocation?: TransportAllocation;
  transportApplyTo?: string[];
  manualAllocations?: { productId: string; amount: number }[];
  foldTransportIntoPrices?: boolean;
  roundingIncrement?: number;
  paymentMethod?: PosPaymentMethod;
  allowNegativeStock?: boolean;
  suspendedFromId?: string;
  notes?: string;
}

/** Structured payload behind an INSUFFICIENT_STOCK refusal from the API. */
export interface StockShortfall {
  productId: string;
  name: string;
  requested: number;
  available: number;
  shortfall: number;
}

export function readStockShortfalls(details: Record<string, unknown> | null | undefined): StockShortfall[] | null {
  if (!details || details.code !== 'INSUFFICIENT_STOCK') return null;
  const shortfalls = details.shortfalls;
  return Array.isArray(shortfalls) && shortfalls.length > 0 ? (shortfalls as StockShortfall[]) : null;
}

export interface SuspendOrderInput {
  customerId?: string;
  customerName?: string;
  label?: string;
  items: PosCartItemInput[];
  transportAmount?: number;
  foldTransportIntoPrices?: boolean;
}

export interface SuspendedOrderItem {
  id: string;
  productId: string | null;
  product: Product | null;
  description: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SuspendedOrder {
  id: string;
  customerId: string | null;
  customerName: string | null;
  customer: { id: string; name: string; businessName: string | null; isCredit: boolean } | null;
  createdBy: { name: string };
  notes: string | null;
  transportAmount: number;
  transportMode: string;
  subtotal: number;
  total: number;
  items: SuspendedOrderItem[];
  createdAt: string;
}

export interface ReturnableItem {
  documentItemId: string;
  productId: string | null;
  description: string;
  unit: string | null;
  unitPrice: number;
  qtySold: number;
  qtyReturned: number;
  qtyReturnable: number;
}

export interface ReturnableSale {
  id: string;
  type: string;
  status: string;
  receiptNumber: string | null;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  customerLabel: string;
  createdAt: string;
  total: number;
  items: ReturnableItem[];
  returns: { id: string; returnNumber: string; total: number; refundMethod: string | null; createdAt: string; itemCount: number }[];
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  documentId: string;
  total: number;
  refundMethod: 'CASH' | 'MPESA' | null;
  reason: string | null;
  createdAt: string;
  items: { id: string; documentItemId: string; description: string; qty: number; unitPrice: number; lineTotal: number }[];
}

export interface PosSaleResultItem {
  id: string;
  description: string;
  qty: number;
  basePrice: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  transportAllocated: number;
  roundingAdjustment: number;
  product: Product | null;
}

export interface PosSaleResult {
  id: string;
  type: string;
  status: string;
  invoiceNumber: string | null;
  receiptNumber: string | null;
  subtotal: number;
  total: number;
  transportAmount: number;
  transportMode: string;
  roundingAdjustment: number;
  paymentMethod: PosPaymentMethod | null;
  customerName: string | null;
  customer: { name: string; businessName: string | null } | null;
  items: PosSaleResultItem[];
  createdAt: string;
}

export const posApi = {
  checkout: (data: PosSaleInput) => api.post<PosSaleResult>('/documents/pos-sale', data),

  // Suspended (parked) orders — stored as real documents, never as local state,
  // so a held order survives a refresh, a crash, or a different till.
  suspend: (data: SuspendOrderInput) => api.post<SuspendedOrder>('/documents/suspend', data),
  suspended: () => api.get<SuspendedOrder[]>('/documents/suspended'),
  discardSuspended: (id: string) => api.post<{ id: string }>(`/documents/suspended/${id}/discard`),

  // Returns against a completed sale.
  returnable: (documentId: string) => api.get<ReturnableSale>(`/documents/${documentId}/returnable`),
  createReturn: (documentId: string, data: { items: { documentItemId: string; qty: number }[]; refundMethod?: 'CASH' | 'MPESA'; reason?: string }) =>
    api.post<SaleReturn>(`/documents/${documentId}/returns`, data),
};