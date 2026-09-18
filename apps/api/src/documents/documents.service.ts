import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, LedgerEntryType, PaymentMethod, Role, TransportMode } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { CreatePosSaleDto } from './dto/pos-sale.dto.js';

type ItemInput = {
  productId?: string;
  description?: string;
  qty: number;
  unitPrice: number;
};

type CreateDocumentInput = {
  customerId?: string;
  customerName?: string;
  items: ItemInput[];
  transportAmount?: number;
  transportAllocation?: 'QUANTITY' | 'VALUE' | 'MANUAL';
  transportApplyTo?: string[];
  manualAllocations?: { productId: string; amount: number }[];
  foldTransportIntoPrices?: boolean;
  roundingIncrement?: number;
  notes?: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  // Shared by posSale() and create() (quotes) so both price a line the same
  // way (brief step 5): qty × unit price = line total, always — where "unit
  // price" is whatever the operator negotiated directly, not a list price
  // with a discount subtracted from it (brief step 4, rule #1). Transport,
  // when folded, is added into that price and rounded there (rule #2); the
  // rounding remainder is tracked separately and never mixed into margin.
  private priceDocumentLines(
    items: { productId?: string | null; description?: string; qty: number; unitPrice: number }[],
    productMap: Map<string, { name: string; displayName: string | null; basePrice: number }>,
    transport: {
      amount: number;
      fold: boolean;
      allocation?: 'QUANTITY' | 'VALUE' | 'MANUAL';
      applyTo?: string[];
      manualAllocations?: { productId: string; amount: number }[];
    },
    roundingIncrement: number,
  ) {
    const transportAmount = transport.amount || 0;
    const fold = transport.fold;
    const transportMode = transportAmount > 0 ? (fold ? TransportMode.DISTRIBUTED : TransportMode.ITEMIZED) : TransportMode.NONE;

    const negotiatedValues = items.map((i) => i.qty * i.unitPrice);
    const targetIdxs = transport.applyTo?.length
      ? items.reduce<number[]>((acc, i, idx) => (i.productId && transport.applyTo!.includes(i.productId) ? [...acc, idx] : acc), [])
      : items.map((_, idx) => idx);

    const allocations: number[] = items.map(() => 0);
    if (transportAmount > 0) {
      if (targetIdxs.length === 0) throw new BadRequestException('No lines selected to apply transport to');
      if (transport.allocation === 'MANUAL') {
        const manualMap = new Map((transport.manualAllocations || []).map((m) => [m.productId, m.amount]));
        const manualSum = [...manualMap.values()].reduce((a, b) => a + b, 0);
        if (Math.abs(manualSum - transportAmount) > 0.01) {
          throw new BadRequestException('Manual transport allocations must sum to the transport amount');
        }
        items.forEach((line, idx) => {
          allocations[idx] = (line.productId && manualMap.get(line.productId)) || 0;
        });
      } else {
        const byValue = transport.allocation === 'VALUE';
        const basis = targetIdxs.reduce((s, idx) => s + (byValue ? negotiatedValues[idx] : items[idx].qty), 0) || 1;
        for (const idx of targetIdxs) {
          const weight = byValue ? negotiatedValues[idx] : items[idx].qty;
          allocations[idx] = transportAmount * (weight / basis);
        }
      }
    }

    const roundUp = (v: number) => Math.ceil(v / roundingIncrement) * roundingIncrement;

    let roundingAdjustmentTotal = 0;
    let subtotalAtNegotiatedPrice = 0;
    let subtotalAtListPrice = 0;
    let impliedDiscountTotal = 0;

    const lines = items.map((line, idx) => {
      const product = line.productId ? productMap.get(line.productId) : undefined;
      // Manual lines (no productId — a one-off labour/service charge) have no
      // list price to compare against, so they never register as "discounted".
      const listPrice = product?.basePrice ?? line.unitPrice;
      const negotiated = negotiatedValues[idx];
      subtotalAtNegotiatedPrice += negotiated;
      subtotalAtListPrice += listPrice * line.qty;
      const impliedDiscount = Math.max(0, listPrice * line.qty - negotiated);
      impliedDiscountTotal += impliedDiscount;

      const allocated = allocations[idx];
      let finalUnitPrice = line.unitPrice;
      let lineRoundingAdjustment = 0;
      let lineTotal = negotiated;

      if (fold && transportAmount > 0) {
        const perUnitWithTransport = (negotiated + allocated) / line.qty;
        finalUnitPrice = roundUp(perUnitWithTransport);
        lineTotal = finalUnitPrice * line.qty;
        lineRoundingAdjustment = lineTotal - (negotiated + allocated);
        roundingAdjustmentTotal += lineRoundingAdjustment;
      }

      return {
        productId: line.productId ?? null,
        description: line.description || product?.displayName || product?.name || 'Item',
        qty: line.qty,
        basePrice: listPrice,
        unitPrice: finalUnitPrice,
        discount: impliedDiscount,
        lineTotal,
        transportAllocated: allocated,
        roundingAdjustment: lineRoundingAdjustment,
      };
    });

    let total = lines.reduce((s, l) => s + l.lineTotal, 0);
    if (!fold && transportAmount > 0) total += transportAmount;

    return { lines, subtotalAtNegotiatedPrice, subtotalAtListPrice, impliedDiscountTotal, roundingAdjustmentTotal, total, transportMode };
  }

  // Brief §24 — enforced here, never trusted from the frontend. Compares
  // against the product's actual current base price, not a client-supplied
  // "before" price, so a line can't be dressed up to hide its real discount.
  private assertDiscountWithinLimit(actorRole: Role, actor: { maxDiscountPercent: number } | null, subtotalAtListPrice: number, impliedDiscountTotal: number) {
    if (actorRole === Role.ADMIN || impliedDiscountTotal <= 0.01) return;
    const allowed = subtotalAtListPrice * ((actor?.maxDiscountPercent || 0) / 100);
    if (impliedDiscountTotal > allowed + 0.01) {
      throw new ForbiddenException(
        `This discount (KSh ${impliedDiscountTotal.toFixed(2)}) exceeds your limit of ${actor?.maxDiscountPercent ?? 0}% (KSh ${allowed.toFixed(2)})`,
      );
    }
  }

  async create(createdById: string, actorRole: Role, input: CreateDocumentInput) {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestException('A document needs at least one item');
    }

    const productIds = [...new Set(input.items.map((i) => i.productId).filter((id): id is string => !!id))];
    const products = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } } }) : [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new NotFoundException(`Product ${id} not found`);
    }

    const actor = actorRole !== Role.ADMIN ? await this.prisma.user.findUnique({ where: { id: createdById } }) : null;

    const businessSettings = await this.settings.get();
    const { lines, subtotalAtNegotiatedPrice, subtotalAtListPrice, impliedDiscountTotal, roundingAdjustmentTotal, total, transportMode } = this.priceDocumentLines(
      input.items,
      productMap,
      {
        amount: input.transportAmount || 0,
        fold: input.foldTransportIntoPrices !== false,
        allocation: input.transportAllocation,
        applyTo: input.transportApplyTo,
        manualAllocations: input.manualAllocations,
      },
      input.roundingIncrement || businessSettings.roundingIncrement,
    );

    this.assertDiscountWithinLimit(actorRole, actor, subtotalAtListPrice, impliedDiscountTotal);

    const doc = await this.prisma.$transaction(async (tx) => {
      const quoteNumber = await this.settings.nextNumber('QUOTE', tx);
      return tx.document.create({
        data: {
          type: DocumentType.QUOTE,
          status: DocumentStatus.QUOTED,
          customerId: input.customerId,
          customerName: input.customerName,
          createdById,
          transportMode,
          transportAmount: input.transportAmount || 0,
          roundingAdjustment: roundingAdjustmentTotal,
          subtotal: subtotalAtNegotiatedPrice,
          total,
          notes: input.notes,
          quoteNumber,
          items: { create: lines },
        },
        include: { items: true, customer: true, createdBy: { select: { name: true } } },
      });
    });

    await this.audit.log({
      actorId: createdById,
      action: 'document.quote_created',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { quoteNumber: doc.quoteNumber, total, itemCount: input.items.length },
    });

    return doc;
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

  // A delivery note is its own frozen document (brief step 7), not a live
  // view of the invoice/quote it came from — copies items/customer/transport
  // at the moment it's created so it survives the source document changing
  // status later (e.g. the invoice being paid, or even cancelled).
  async createDeliveryNote(sourceId: string, actorId: string) {
    const source = await this.findOne(sourceId);
    if (source.type === DocumentType.DELIVERY_NOTE) {
      throw new BadRequestException('Cannot create a delivery note from another delivery note');
    }
    if (source.status !== DocumentStatus.QUOTED && source.status !== DocumentStatus.INVOICED && source.status !== DocumentStatus.PAID) {
      throw new BadRequestException('A delivery note can only be created from a live quote or invoice');
    }

    const doc = await this.prisma.$transaction(async (tx) => {
      const deliveryNoteNumber = await this.settings.nextNumber('DELIVERY_NOTE', tx);
      return tx.document.create({
        data: {
          type: DocumentType.DELIVERY_NOTE,
          status: DocumentStatus.DRAFT, // delivery notes don't carry their own financial stage
          customerId: source.customerId,
          customerName: source.customerName,
          createdById: actorId,
          transportMode: source.transportMode,
          transportAmount: source.transportAmount,
          roundingAdjustment: source.roundingAdjustment,
          subtotal: source.subtotal,
          total: source.total,
          notes: source.notes,
          sourceDocumentId: source.id,
          deliveryNoteNumber,
          items: {
            create: source.items.map((i) => ({
              productId: i.productId,
              description: i.description,
              qty: i.qty,
              basePrice: i.basePrice,
              unitPrice: i.unitPrice,
              discount: i.discount,
              lineTotal: i.lineTotal,
              transportAllocated: i.transportAllocated,
              roundingAdjustment: i.roundingAdjustment,
            })),
          },
        },
        include: { items: { include: { product: true } }, customer: true, createdBy: { select: { name: true } } },
      });
    });

    await this.audit.log({
      actorId,
      action: 'document.delivery_note_created',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { deliveryNoteNumber: doc.deliveryNoteNumber, sourceDocumentId: source.id },
    });

    return doc;
  }

  findAll(params: { status?: DocumentStatus; type?: DocumentType; from?: string; to?: string }) {
    const { status, type, from, to } = params;
    return this.prisma.document.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
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
  // so history (who quoted it, when) is never lost. This is also where stock
  // actually leaves for the quote/invoice workflow (unlike POS, which
  // deducts immediately) — an invoice is the point the sale is committed,
  // even if payment (credit) comes later. If the customer is a credit
  // account, this also books the invoice onto their credit ledger — see
  // brief §26, Customer.creditBalance is never touched directly.
  async convertToInvoice(id: string, actorId: string, allowNegativeStock = false) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.QUOTED) {
      throw new BadRequestException('Only a quoted document can be converted to an invoice');
    }

    let allowNegative = false;
    if (allowNegativeStock) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (actor?.role !== Role.ADMIN && !actor?.canInvoiceWithoutStock) {
        throw new ForbiddenException('You are not authorized to invoice against stock the system does not have recorded');
      }
      allowNegative = true;
    }

    const shortfalls: { productId: string; name: string; shortfall: number }[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.settings.nextNumber('INVOICE', tx);
      const result = await tx.document.update({
        where: { id },
        data: { type: DocumentType.INVOICE, status: DocumentStatus.INVOICED, invoicedAt: new Date(), invoiceNumber },
      });

      for (const item of doc.items) {
        if (item.productId) {
          const { shortfall } = await this.inventory.consumeFifo(item.productId, item.qty, 'SALE', actorId, `Invoice ${doc.id}`, allowNegative, tx);
          if (shortfall > 0) {
            shortfalls.push({ productId: item.productId, name: item.product?.displayName ?? item.product?.name ?? item.description, shortfall });
          }
        }
      }

      if (doc.customerId && doc.customer?.isCredit) {
        await tx.customerLedgerEntry.create({
          data: { customerId: doc.customerId, type: LedgerEntryType.INVOICE, amount: doc.total, documentId: doc.id, createdById: actorId },
        });
        await tx.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { increment: doc.total } } });
      }

      return result;
    });

    await this.audit.log({
      actorId,
      action: 'document.quote_converted',
      entityType: 'Document',
      entityId: id,
      metadata: { invoiceNumber: updated.invoiceNumber, total: doc.total },
    });

    if (shortfalls.length > 0) {
      await this.audit.log({
        actorId,
        action: 'document.stock_override_used',
        entityType: 'Document',
        entityId: id,
        metadata: { shortfalls },
      });
    }

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

    return this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.settings.nextNumber('RECEIPT', tx);
      const updated = await tx.document.update({
        where: { id },
        data: { type: DocumentType.RECEIPT, status: DocumentStatus.PAID, paidAt: new Date(), receiptNumber },
      });

      if (doc.customerId && doc.customer?.isCredit) {
        await tx.customerLedgerEntry.create({
          data: { customerId: doc.customerId, type: LedgerEntryType.PAYMENT, amount: -doc.total, documentId: doc.id, note: 'Invoice paid in full', createdById: actorId },
        });
        await tx.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { decrement: doc.total } } });
      }

      return updated;
    });
  }

  async cancel(id: string, actorId: string) {
    const doc = await this.findOne(id);
    const updated = await this.prisma.document.update({ where: { id }, data: { status: DocumentStatus.CANCELLED } });
    await this.audit.log({
      actorId,
      action: 'document.cancelled',
      entityType: 'Document',
      entityId: id,
      metadata: { previousStatus: doc.status, total: doc.total },
    });
    return updated;
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
    // Fetched once for both the discount-limit and stock-override checks below.
    const actor = actorRole !== Role.ADMIN ? await this.prisma.user.findUnique({ where: { id: actorId } }) : null;

    // --- Stock check ---
    const canOverrideStock = actorRole === Role.ADMIN || !!actor?.canInvoiceWithoutStock;
    if (input.allowNegativeStock && !canOverrideStock) {
      throw new ForbiddenException('You are not authorized to invoice against stock the system does not have recorded');
    }
    const allowNegative = !!input.allowNegativeStock && canOverrideStock;
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

    // --- Per-line pricing: negotiated price -> (+transport if folded) -> commercial rounding (brief §14-17, §59) ---
    const businessSettings = await this.settings.get();
    const roundingIncrement = input.roundingIncrement || businessSettings.roundingIncrement;
    const {
      lines: computedLines,
      subtotalAtNegotiatedPrice: subtotal,
      subtotalAtListPrice,
      impliedDiscountTotal,
      roundingAdjustmentTotal,
      total,
      transportMode,
    } = this.priceDocumentLines(
      input.items,
      productMap,
      {
        amount: input.transportAmount || 0,
        fold: input.foldTransportIntoPrices !== false,
        allocation: input.transportAllocation,
        applyTo: input.transportApplyTo,
        manualAllocations: input.manualAllocations,
      },
      roundingIncrement,
    );

    this.assertDiscountWithinLimit(actorRole, actor, subtotalAtListPrice, impliedDiscountTotal);

    const saleShortfalls: { productId: string; name: string; shortfall: number }[] = [];
    const type = input.paymentMethod === 'CREDIT' ? DocumentType.INVOICE : DocumentType.RECEIPT;
    const status = input.paymentMethod === 'CREDIT' ? DocumentStatus.INVOICED : DocumentStatus.PAID;
    const now = new Date();

    const doc = await this.prisma.$transaction(async (tx) => {
      const number = status === DocumentStatus.INVOICED ? await this.settings.nextNumber('INVOICE', tx) : await this.settings.nextNumber('RECEIPT', tx);

      const created = await tx.document.create({
        data: {
          type,
          status,
          customerId: input.customerId,
          customerName: input.customerName,
          createdById: actorId,
          transportMode,
          transportAmount: input.transportAmount || 0,
          roundingAdjustment: roundingAdjustmentTotal,
          paymentMethod: input.paymentMethod as PaymentMethod,
          subtotal,
          total,
          notes: input.notes,
          invoicedAt: status === DocumentStatus.INVOICED ? now : undefined,
          paidAt: status === DocumentStatus.PAID ? now : undefined,
          invoiceNumber: status === DocumentStatus.INVOICED ? number : undefined,
          receiptNumber: status === DocumentStatus.PAID ? number : undefined,
          items: { create: computedLines },
        },
      });

      // Consume real stock, oldest cost lot first — inside this same transaction.
      for (const line of computedLines) {
        if (!line.productId) continue;
        const { shortfall } = await this.inventory.consumeFifo(line.productId, line.qty, 'SALE', actorId, `Sale ${created.id}`, allowNegative, tx);
        if (shortfall > 0) {
          saleShortfalls.push({ productId: line.productId, name: line.description, shortfall });
        }
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

    if (saleShortfalls.length > 0) {
      await this.audit.log({
        actorId,
        action: 'document.stock_override_used',
        entityType: 'Document',
        entityId: doc!.id,
        metadata: { shortfalls: saleShortfalls },
      });
    }

    return doc;
  }
}