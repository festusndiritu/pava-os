import { api } from './api';

export interface BusinessSettings {
  id: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  quotePrefix: string;
  invoicePrefix: string;
  receiptPrefix: string;
  deliveryNotePrefix: string;
  returnPrefix: string;
  nextQuoteSeq: number;
  nextInvoiceSeq: number;
  nextReceiptSeq: number;
  nextDeliveryNoteSeq: number;
  nextReturnSeq: number;
  roundingIncrement: number;
  lowStockThreshold: number;
  documentFooter: string | null;
  paymentDetails: string | null;
  updatedAt: string;
}

export type UpdateBusinessSettings = Partial<
  Pick<
    BusinessSettings,
    'businessName' | 'address' | 'phone' | 'email' | 'quotePrefix' | 'invoicePrefix' | 'receiptPrefix' | 'roundingIncrement' | 'lowStockThreshold' | 'documentFooter' | 'paymentDetails'
  >
>;

export const settingsApi = {
  get: () => api.get<BusinessSettings>('/settings'),
  update: (data: UpdateBusinessSettings) => api.patch<BusinessSettings>('/settings', data),
};