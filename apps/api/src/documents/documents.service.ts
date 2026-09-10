import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, LedgerEntryType, PaymentMethod, Role, TransportMode } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreatePosSaleDto } from './dto/pos-sale.dto.js';

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
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private audit: AuditService,
  ) {}

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
  // so history (who quoted it, when) is never lost. If the customer is a
  // credit account, this also books the invoice onto their credit ledger —
  // see brief §26, Customer.creditBalance is never touched directly.
  async convertToInvoice(id: string, actorId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.QUOTED) {
      throw new BadRequestException('Only a quoted document can be converted to an invoice');
    }

    const ops: any[] = [
      this.prisma.document.update({
        where: { id },
        data: { type: DocumentType.INVOICE, status: DocumentStatus.INVOICED, invoicedAt: new Date() },
      }),
    ];

    if (doc.customerId && doc.customer?.isCredit) {
      ops.push(
        this.prisma.customerLedgerEntry.create({
          data: { customerId: doc.customerId, type: LedgerEntryType.INVOICE, amount: doc.total, documentId: doc.id, createdById: actorId },
        }),
        this.prisma.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { increment: doc.total } } }),
      );
    }

    const [updated] = await this.prisma.$transaction(ops);
    return updated;
  }

  // Invoice -> Paid (which is effectively "receipt issued"). Same record
  // again. For a credit customer this assumes the invoice is paid in full —
  // partial payments against an open invoice are a deeper Phase 6 concern;
  // for now the ledger's PAYMENT entry always matches the invoice total.
  async markPaid(id: string, actorId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.INVOICED) {
      throw new BadRequestException('Only an invoiced document can be marked paid');
    }

    const ops: any[] = [
      this.prisma.document.update({
        where: { id },
        data: { type: DocumentType.RECEIPT, status: DocumentStatus.PAID, paidAt: new Date() },
      }),
    ];

    if (doc.customerId && doc.customer?.isCredit) {
      ops.push(
        this.prisma.customerLedgerEntry.create({
          data: { customerId: doc.customerId, type: LedgerEntryType.PAYMENT, amount: -doc.total, documentId: doc.id, note: 'Invoice paid in full', createdById: actorId },
        }),
        this.prisma.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { decrement: doc.total } } }),
      );
    }

    const [updated] = await this.prisma.$transaction(ops);
    return updated;
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

  // The POS checkout path (brief §14-17, §27, §59). One atomic transaction:
  // validate discount + stock, allocate transport, apply commercial
  // rounding, freeze the document lines, consume inventory FIFO, post to
  // the customer's credit ledger if applicable. All-or-nothing — brief §70.
  async posSale(actorId: string, actorRole: Role, input: CreatePosSaleDto) {
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new NotFoundException(`Product ${id} not found`);
    }

    // --- Discount limit (brief §24 — enforced here, never trusted from the frontend) ---
    const subtotalBeforeDiscount = input.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const totalDiscount = input.items.reduce((s, i) => s + (i.discount || 0), 0);
    for (const line of input.items) {
      if ((line.discount || 0) > line.qty * line.unitPrice) {
        throw new BadRequestException(`Discount exceeds the line value for ${productMap.get(line.productId)?.name}`);
      }
    }
    if (actorRole !== Role.ADMIN && totalDiscount > 0) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      const allowed = subtotalBeforeDiscount * ((actor?.maxDiscountPercent || 0) / 100);
      if (totalDiscount > allowed + 0.01) {
        throw new ForbiddenException(
          `This discount (KSh ${totalDiscount.toFixed(2)}) exceeds your limit of ${actor?.maxDiscountPercent ?? 0}% (KSh ${allowed.toFixed(2)})`,
        );
      }
    }

    // --- Stock check ---
    const allowNegative = !!input.allowNegativeStock && actorRole === Role.ADMIN;
    if (!allowNegative) {
      const shortfalls = input.items
        .map((line) => ({ line, product: productMap.get(line.productId)! }))
        .filter(({ line, product }) => product.stockQuantity < line.qty);
      if (shortfalls.length > 0) {
        const detail = shortfalls.map(({ line, product }) => `${product.name} (need ${line.qty}, have ${product.stockQuantity})`).join(', ');
        throw new BadRequestException(`Insufficient stock: ${detail}`);
      }
    }

    // --- Payment method / credit customer validation ---
    let customer = null;
    if (input.customerId) {
      customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    if (input.paymentMethod === 'CREDIT' && !customer?.isCredit) {
      throw new BadRequestException('Credit sales require a credit-account customer');
    }

    // --- Transport allocation (brief §14-15) ---
    const transportAmount = input.transportAmount || 0;
    const fold = input.foldTransportIntoPrices !== false; // default true: "delivery included" pricing
    const transportMode = transportAmount > 0 ? (fold ? TransportMode.DISTRIBUTED : TransportMode.ITEMIZED) : TransportMode.NONE;
    const allocations = new Map<string, number>();

    if (transportAmount > 0) {
      const targetIds = input.transportApplyTo?.length ? new Set(input.transportApplyTo) : null;
      const targetLines = input.items.filter((l) => !targetIds || targetIds.has(l.productId));
      if (targetLines.length === 0) throw new BadRequestException('No lines selected to apply transport to');

      if (input.transportAllocation === 'MANUAL') {
        const manualMap = new Map((input.manualAllocations || []).map((m) => [m.productId, m.amount]));
        const manualSum = [...manualMap.values()].reduce((a, b) => a + b, 0);
        if (Math.abs(manualSum - transportAmount) > 0.01) {
          throw new BadRequestException('Manual transport allocations must sum to the transport amount');
        }
        for (const line of input.items) allocations.set(line.productId, manualMap.get(line.productId) || 0);
      } else {
        const byValue = input.transportAllocation === 'VALUE';
        const basis = targetLines.reduce((s, l) => s + (byValue ? l.qty * l.unitPrice - (l.discount || 0) : l.qty), 0) || 1;
        for (const line of input.items) {
          if (targetIds && !targetIds.has(line.productId)) {
            allocations.set(line.productId, 0);
            continue;
          }
          const weight = byValue ? line.qty * line.unitPrice - (line.discount || 0) : line.qty;
          allocations.set(line.productId, transportAmount * (weight / basis));
        }
      }
    } else {
      for (const line of input.items) allocations.set(line.productId, 0);
    }

    // --- Per-line pricing: base -> (+transport if folded) -> commercial rounding ---
    const roundingIncrement = input.roundingIncrement || 5;
    const roundUp = (v: number) => Math.ceil(v / roundingIncrement) * roundingIncrement;

    let subtotal = 0;
    let roundingAdjustmentTotal = 0;
    const computedLines = input.items.map((line) => {
      const base = line.qty * line.unitPrice - (line.discount || 0);
      subtotal += base;
      const allocated = allocations.get(line.productId) || 0;

      let finalUnitPrice = line.unitPrice - (line.discount || 0) / line.qty;
      let lineRoundingAdjustment = 0;
      let lineTotal = base;

      if (fold && transportAmount > 0) {
        const perUnitWithTransport = (base + allocated) / line.qty;
        finalUnitPrice = roundUp(perUnitWithTransport);
        lineTotal = finalUnitPrice * line.qty;
        lineRoundingAdjustment = lineTotal - (base + allocated);
        roundingAdjustmentTotal += lineRoundingAdjustment;
      }

      return {
        productId: line.productId,
        product: productMap.get(line.productId)!,
        qty: line.qty,
        basePrice: line.unitPrice, // the price before this line's discount — kept for the receipt's "normal price" display
        discount: line.discount || 0,
        unitPrice: finalUnitPrice,
        lineTotal,
        transportAllocated: allocated,
        roundingAdjustment: lineRoundingAdjustment,
      };
    });

    let total = computedLines.reduce((s, l) => s + l.lineTotal, 0);
    if (!fold && transportAmount > 0) total += transportAmount;

    const type = input.paymentMethod === 'CREDIT' ? DocumentType.INVOICE : DocumentType.RECEIPT;
    const status = input.paymentMethod === 'CREDIT' ? DocumentStatus.INVOICED : DocumentStatus.PAID;
    const now = new Date();

    const doc = await this.prisma.$transaction(async (tx) => {
      const items = computedLines.map((l) => ({
        productId: l.productId,
        description: l.product.displayName ?? l.product.name,
        qty: l.qty,
        basePrice: l.basePrice,
        unitPrice: l.unitPrice,
        discount: l.discount,
        lineTotal: l.lineTotal,
        transportAllocated: l.transportAllocated,
        roundingAdjustment: l.roundingAdjustment,
      }));
      if (!fold && transportAmount > 0) {
        items.push({
          productId: null as any,
          description: 'Delivery',
          qty: 1,
          basePrice: transportAmount,
          unitPrice: transportAmount,
          discount: 0,
          lineTotal: transportAmount,
          transportAllocated: 0,
          roundingAdjustment: 0,
        });
      }

      const created = await tx.document.create({
        data: {
          type,
          status,
          customerId: input.customerId,
          customerName: input.customerName,
          createdById: actorId,
          transportMode,
          transportAmount,
          roundingAdjustment: roundingAdjustmentTotal,
          paymentMethod: input.paymentMethod as PaymentMethod,
          subtotal,
          total,
          notes: input.notes,
          invoicedAt: status === DocumentStatus.INVOICED ? now : undefined,
          paidAt: status === DocumentStatus.PAID ? now : undefined,
          items: { create: items },
        },
      });

      // Consume real stock, oldest cost lot first — inside this same transaction.
      for (const line of computedLines) {
        await this.inventory.consumeFifo(line.productId, line.qty, 'SALE', actorId, `Sale ${created.id}`, allowNegative, tx);
      }

      if (input.paymentMethod === 'CREDIT' && input.customerId) {
        await tx.customerLedgerEntry.create({
          data: { customerId: input.customerId, type: LedgerEntryType.INVOICE, amount: total, documentId: created.id, createdById: actorId },
        });
        await tx.customer.update({ where: { id: input.customerId }, data: { creditBalance: { increment: total } } });
      }

      return tx.document.findUnique({
        where: { id: created.id },
        include: { items: { include: { product: true } }, customer: true, createdBy: { select: { name: true } } },
      });
    });

    await this.audit.log({
      actorId,
      action: 'documents.pos_sale',
      entityType: 'Document',
      entityId: doc!.id,
      metadata: { total, paymentMethod: input.paymentMethod, itemCount: input.items.length },
    });

    return doc;
  }
}