
import { api } from './api';
import type { Product } from './products-api';

export type PosPaymentMethod = 'CASH' | 'MPESA' | 'CARD' | 'CREDIT';
export type TransportAllocation = 'QUANTITY' | 'VALUE' | 'MANUAL';

export interface PosCartItemInput {
  productId: string;
  qty: number;
  unitPrice: number;
  discount?: number;
}

export interface PosSaleInput {
  customerId?: string;
  customerName?: string;
  items: PosCartItemInput[];
  transportAmount?: number;
  transportAllocation?: TransportAllocation;
  transportApplyTo?: string[];
  manualAllocations?: { productId: string; amount: number }[];
  foldTransportIntoPrices?: boolean;
  roundingIncrement?: number;
  paymentMethod: PosPaymentMethod;
  allowNegativeStock?: boolean;
  notes?: string;
}

export interface PosSaleResultItem {
  id: string;
  description: string;
  qty: number;
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
  subtotal: number;
  total: number;
  transportAmount: number;
  transportMode: string;
  roundingAdjustment: number;
  paymentMethod: PosPaymentMethod;
  customerName: string | null;
  customer: { name: string; businessName: string | null } | null;
  items: PosSaleResultItem[];
  createdAt: string;
}

export const posApi = {
  checkout: (data: PosSaleInput) => api.post<PosSaleResult>('/documents/pos-sale', data),
};