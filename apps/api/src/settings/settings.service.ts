import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BusinessSetting } from '../../generated/prisma/client.js';

const SINGLETON_ID = 'singleton';
const CACHE_TTL_MS = 60_000;
type DocNumberType = 'QUOTE' | 'INVOICE' | 'RECEIPT' | 'DELIVERY_NOTE' | 'RETURN';

@Injectable()
export class SettingsService {
  private cached: { row: BusinessSetting; at: number } | null = null;

  constructor(private prisma: PrismaService) {}

  /** Read on nearly every sale and changed rarely, so it is served from memory; the short TTL bounds staleness across API instances. */
  async get() {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) return this.cached.row;
    const row = await this.prisma.businessSetting.upsert({ where: { id: SINGLETON_ID }, update: {}, create: { id: SINGLETON_ID } });
    this.cached = { row, at: Date.now() };
    return row;
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
    quoteValidityDays: number;
    leadTimeDays: number;
    coverDays: number;
    serviceLevel: number;
    documentFooter: string;
    paymentDetails: string;
  }>) {
    const row = await this.prisma.businessSetting.upsert({ where: { id: SINGLETON_ID }, update: data, create: { id: SINGLETON_ID, ...data } });
    this.cached = { row, at: Date.now() };
    return row;
  }

  async nextNumber(type: DocNumberType, client?: any): Promise<string> {
    const db = client ?? this.prisma;
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

    const updated = await db.businessSetting.upsert({
      where: { id: SINGLETON_ID },
      update: { [field]: { increment: 1 } },
      create: { id: SINGLETON_ID, [field]: 2 },
    });

    this.cached = null;
    const seq: number = updated[field] - 1;
    const prefix: string = updated[prefixField];
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
  }
}