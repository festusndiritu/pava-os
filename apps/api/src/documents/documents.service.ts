import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, TransportMode } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type ItemInput = {
  productId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

type CreateDocumentInput = {
  customerId?: string;
  customerName?: string;
  items: ItemInput[];
  transportMode?: TransportMode;
  transportAmount?: number;
  notes?: string;
};

function computeTotals(items: ItemInput[], transportMode: TransportMode, transportAmount: number) {
  const lineTotals = items.map((i) => Math.max(0, i.qty * i.unitPrice - (i.discount || 0)));
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  // ITEMIZED: transport is added on top as its own line.
  // DISTRIBUTED: transport cost is already folded into the item unit prices bro set,
  // so it is NOT added again — it's tracked only for reporting/reference.
  // NONE: no transport charge on this document at all.
  const total = transportMode === TransportMode.ITEMIZED ? subtotal + transportAmount : subtotal;
  return { lineTotals, subtotal, total };
}

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(createdById: string, input: CreateDocumentInput) {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestException('A document needs at least one item');
    }
    const transportMode = input.transportMode || TransportMode.NONE;
    const transportAmount = input.transportAmount || 0;
    const { lineTotals, subtotal, total } = computeTotals(input.items, transportMode, transportAmount);

    return this.prisma.document.create({
      data: {
        type: DocumentType.QUOTE,
        status: DocumentStatus.QUOTED,
        customerId: input.customerId,
        customerName: input.customerName,
        createdById,
        transportMode,
        transportAmount,
        subtotal,
        total,
        notes: input.notes,
        items: {
          create: input.items.map((i, idx) => ({
            productId: i.productId,
            description: i.description,
            qty: i.qty,
            unitPrice: i.unitPrice,
            discount: i.discount || 0,
            lineTotal: lineTotals[idx],
          })),
        },
      },
      include: { items: true, customer: true, createdBy: { select: { name: true } } },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        createdBy: { select: { name: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  findAll(params: { status?: DocumentStatus; from?: string; to?: string }) {
    const { status, from, to } = params;
    return this.prisma.document.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { customer: true, createdBy: { select: { name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Quote -> Invoice is a status change on the SAME record. No copy, no new id,
  // so history (who quoted it, when) is never lost.
  async convertToInvoice(id: string) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.QUOTED) {
      throw new BadRequestException('Only a quoted document can be converted to an invoice');
    }
    return this.prisma.document.update({
      where: { id },
      data: { type: DocumentType.INVOICE, status: DocumentStatus.INVOICED, invoicedAt: new Date() },
    });
  }

  // Invoice -> Paid (which is effectively "receipt issued"). Same record again.
  async markPaid(id: string) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.INVOICED) {
      throw new BadRequestException('Only an invoiced document can be marked paid');
    }
    return this.prisma.document.update({
      where: { id },
      data: { type: DocumentType.RECEIPT, status: DocumentStatus.PAID, paidAt: new Date() },
    });
  }

  async cancel(id: string) {
    await this.findOne(id);
    return this.prisma.document.update({ where: { id }, data: { status: DocumentStatus.CANCELLED } });
  }

  // Minimal dashboard aggregate — real reports page can build on this later.
  async salesSummary(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const docs = await this.prisma.document.findMany({
      where: { status: DocumentStatus.PAID, paidAt: { gte: since } },
      select: { total: true, paidAt: true },
    });
    const byDay = new Map<string, number>();
    for (const d of docs) {
      const key = d.paidAt!.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + d.total);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, total]) => ({ date, total }));
  }
}
