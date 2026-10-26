import { api } from './api';
import type { Product } from './products-api';

// The till takes M-Pesa Paybill (the default) and cash.
export type PosPaymentMethod = 'MPESA' | 'CASH';

export const POS_PAYMENT_METHODS: { value: PosPaymentMethod; label: string; hint: string }[] = [
  { value: 'MPESA', label: 'M-Pesa', hint: 'Paybill' },
  { value: 'CASH', label: 'Cash', hint: 'At the counter' },
];
export interface PaymentLine {
  method: PosPaymentMethod;
  amount: number;
}

export type TransportAllocation = 'QUANTITY' | 'VALUE' | 'MANUAL';

export interface PosCartItemInput {
  productId: string;
  qty: number;
  unitPrice: number;
  stockQty?: number;
  supplierSource?: string;
}

export interface PosSaleInput {
  settleLater?: boolean;
  customerId?: string;
  customerName?: string;
  items: PosCartItemInput[];
  discount?: number;
  transportAmount?: number;
  transportAllocation?: TransportAllocation;
  transportApplyTo?: string[];
  manualAllocations?: { productId: string; amount: number }[];
  foldTransportIntoPrices?: boolean;
  roundingIncrement?: number;
  paymentMethod?: PosPaymentMethod;
  payments?: PaymentLine[];
  changeAction?: 'GIVE' | 'CREDIT';
  creditApplied?: number;
  allowNegativeStock?: boolean; // legacy: sell beyond shelf stock as a backorder. The till now splits fulfilment instead.
  suspendedFromId?: string;
  notes?: string;
}

/** Structured payload behind an INSUFFICIENT_STOCK refusal from the API: the shop's shelf cannot cover what was asked to leave it. */
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
  customerId: string | null;
  customerLabel: string;
  createdAt: string;
  total: number;
  // Share of each line price actually paid after a whole-bill discount (1 when none).
  refundFactor?: number;
  items: ReturnableItem[];
  returns: { id: string; returnNumber: string; total: number; refundMethod: string | null; createdAt: string; itemCount: number }[];
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  documentId: string;
  total: number;
  refundMethod: 'CASH' | 'MPESA' | 'STORE_CREDIT' | null;
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
  discount?: number;
  total: number;
  transportAmount: number;
  transportMode: string;
  roundingAdjustment: number;
  paymentMethod: PosPaymentMethod | 'MIXED' | 'STORE_CREDIT' | null;
  changeGiven?: number;
  changeToCredit?: number;
  creditApplied?: number;
  payments?: { id: string; method: PosPaymentMethod | 'STORE_CREDIT'; amount: number }[];
  customerName: string | null;
  customer: { name: string; businessName: string | null } | null;
  items: PosSaleResultItem[];
  createdAt: string;
}

export const posApi = {
  checkout: (data: PosSaleInput) => api.post<PosSaleResult>('/documents/pos-sale', data),

  // Suspended (parked) orders — stored as real documents, never as local state, so a held order
  // survives a refresh, a crash, or a different till.
  suspend: (data: SuspendOrderInput) => api.post<SuspendedOrder>('/documents/suspend', data),
  suspended: () => api.get<SuspendedOrder[]>('/documents/suspended'),
  discardSuspended: (id: string) => api.post<{ id: string }>(`/documents/suspended/${id}/discard`),

  returnable: (documentId: string) => api.get<ReturnableSale>(`/documents/${documentId}/returnable`),
  createReturn: (documentId: string, data: { items: { documentItemId: string; qty: number }[]; refundMethod?: 'CASH' | 'MPESA' | 'STORE_CREDIT'; reason?: string }) =>
    api.post<SaleReturn>(`/documents/${documentId}/returns`, data),
};