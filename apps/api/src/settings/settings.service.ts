import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const SINGLETON_ID = 'singleton';
type DocNumberType = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'DELIVERY_NOTE' | 'RETURN';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Lazy-init: the first read (or write) ever made creates the singleton row with defaults
  async get() {
    const existing = await this.prisma.businessSetting.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.prisma.businessSetting.create({ data: { id: SINGLETON_ID } });
  }

  async update(data: Partial<{
    businessName: string;
    address: string;
    phone: string;
    email: string;
    quotePrefix: string;
    invoicePrefix: string;
    receiptPrefix: string;
    deliveryNotePrefix: string;
    returnPrefix: string;
    roundingIncrement: number;
    lowStockThreshold: number;
    documentFooter: string;
    paymentDetails: string;
  }>) {
    await this.get(); // ensure the row exists before updating it
    return this.prisma.businessSetting.update({ where: { id: SINGLETON_ID }, data });
  }

  async nextNumber(type: DocNumberType, client?: any): Promise<string> {
    const db = client ?? this.prisma;
    await this.get(); // ensure the row exists
    const SEQ_FIELDS: Record<DocNumberType, string> = {
      QUOTE: 'nextQuoteSeq',
      INVOICE: 'nextInvoiceSeq',
      RECEIPT: 'nextReceiptSeq',
      DELIVERY_NOTE: 'nextDeliveryNoteSeq',
      RETURN: 'nextReturnSeq',
    };
    const PREFIX_FIELDS: Record<DocNumberType, string> = {
      QUOTE: 'quotePrefix',
      INVOICE: 'invoicePrefix',
      RECEIPT: 'receiptPrefix',
      DELIVERY_NOTE: 'deliveryNotePrefix',
      RETURN: 'returnPrefix',
    };
    const field = SEQ_FIELDS[type];
    const prefixField = PREFIX_FIELDS[type];

    const updated = await db.businessSetting.update({
      where: { id: SINGLETON_ID },
      data: { [field]: { increment: 1 } },
    });

    const seq: number = updated[field] - 1;
    const prefix: string = updated[prefixField];
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
  }
}