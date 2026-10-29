import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, LedgerEntryType, Role, TransportMode } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { roundMoney } from '../common/money.js';
import { nullsLast, parseSort, type SortDir } from '../common/paging.js';
import type { CreatePosSaleDto } from './dto/pos-sale.dto.js';
import { settlePayments, type TenderInput } from './payments.js';

function endOfDay(date: string) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return new Date(end.getTime() + 1);
}

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
  discount?: number;
  notes?: string;
};

// What a table header can sort documents by (`field:dir`, see parseSort).
const SORT_FIELDS: Record<string, (dir: SortDir) => object> = {
  quoteNumber: (d) => ({ quoteNumber: nullsLast(d) }),
  invoiceNumber: (d) => ({ invoiceNumber: nullsLast(d) }),
  deliveryNoteNumber: (d) => ({ deliveryNoteNumber: nullsLast(d) }),
  customer: (d) => ({ customer: { name: d } }),
  created: (d) => ({ createdAt: d }),
  invoiced: (d) => ({ invoicedAt: nullsLast(d) }),
  status: (d) => ({ status: d }),
  total: (d) => ({ total: d }),
};

function orderByFor(raw?: string): any[] {
  const sort = parseSort(raw);
  const make = sort && SORT_FIELDS[sort.field];
  return [...(make && sort ? [make(sort.dir)] : []), ...(sort?.field === 'created' && make ? [] : [{ createdAt: 'desc' }]), { id: 'desc' }];
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  // Shared by posSale() and create() (quotes) so both price a line the same way (brief step 5): qty
  // × unit price = line total, always — where "unit price" is whatever the operator negotiated
  // directly, not a list price with a discount subtracted from it (brief step 4, rule #1).
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
          allocations[idx] = roundMoney(transportAmount * (weight / basis));
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
      // Manual lines (no productId — a one-off labour/service charge) have no list price to compare
      // against, so they never register as "discounted".
      const listPrice = product?.basePrice ?? line.unitPrice;
      const negotiated = roundMoney(negotiatedValues[idx]);
      subtotalAtNegotiatedPrice += negotiated;
      subtotalAtListPrice += roundMoney(listPrice * line.qty);
      const impliedDiscount = roundMoney(Math.max(0, listPrice * line.qty - negotiated));
      impliedDiscountTotal += impliedDiscount;

      const allocated = allocations[idx];
      let finalUnitPrice = line.unitPrice;
      let lineRoundingAdjustment = 0;
      let lineTotal = negotiated;

      if (fold && transportAmount > 0) {
        const perUnitWithTransport = (negotiated + allocated) / line.qty;
        finalUnitPrice = roundUp(perUnitWithTransport);
        lineTotal = roundMoney(finalUnitPrice * line.qty);
        lineRoundingAdjustment = roundMoney(lineTotal - (negotiated + allocated));
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

    return {
      lines,
      subtotalAtNegotiatedPrice: roundMoney(subtotalAtNegotiatedPrice),
      subtotalAtListPrice: roundMoney(subtotalAtListPrice),
      impliedDiscountTotal: roundMoney(impliedDiscountTotal),
      roundingAdjustmentTotal: roundMoney(roundingAdjustmentTotal),
      total: roundMoney(total),
      transportMode,
    };
  }

  // Brief §24 — enforced here, never trusted from the frontend.
  private assertDiscountWithinLimit(actorRole: Role, actor: { maxDiscountPercent: number } | null, subtotalAtListPrice: number, impliedDiscountTotal: number) {
    if (actorRole === Role.ADMIN || impliedDiscountTotal <= 0.01) return;
    const allowed = subtotalAtListPrice * ((actor?.maxDiscountPercent || 0) / 100);
    if (impliedDiscountTotal > allowed + 0.01) {
      throw new ForbiddenException(
        `This discount (KSh ${impliedDiscountTotal.toFixed(2)}) exceeds your limit of ${actor?.maxDiscountPercent ?? 0}% (KSh ${allowed.toFixed(2)})`,
      );
    }
  }

  // The whole-bill discount sits on top of the per-line prices: the total drops by it, and it counts
  // toward the same discount limit as any line discount.
  private applyTotalDiscount<T extends { total: number; subtotalAtListPrice: number; impliedDiscountTotal: number }>(
    priced: T,
    discount: number | undefined,
    actorRole: Role,
    actor: { maxDiscountPercent: number } | null,
  ) {
    const amount = discount ?? 0;
    if (amount > 0 && amount >= priced.total) throw new BadRequestException('The discount must be less than the total');
    this.assertDiscountWithinLimit(actorRole, actor, priced.subtotalAtListPrice, priced.impliedDiscountTotal + amount);
    return { ...priced, discount: amount, total: roundMoney(priced.total - amount) };
  }

  // One shape of error for every "not enough stock" refusal, so the POS and the quote->invoice
  // screen can both render a proper confirmation dialog (product, requested, available, short by)
  // instead of parsing a sentence.
  private insufficientStock(shortfalls: { productId: string; name: string; requested: number; available: number; shortfall: number }[]) {
    return new BadRequestException({
      statusCode: 400,
      code: 'INSUFFICIENT_STOCK',
      message: `Insufficient stock: ${shortfalls.map((s) => `${s.name} (need ${s.requested}, have ${s.available})`).join(', ')}`,
      shortfalls,
    });
  }

  // Turns what the operator said about where each line comes from into the figures stored on it.
  private resolveFulfilment(
    lines: { productId: string | null; qty: number; description?: string }[],
    requested: ({ stockQty?: number; supplierSource?: string } | undefined)[],
  ) {
    return lines.map((line, i) => {
      if (!line.productId) return { stockQty: null as number | null, supplierSource: null as string | null };
      const want = requested[i]?.stockQty;
      const stockQty = want ?? line.qty;
      if (!Number.isInteger(stockQty) || stockQty < 0 || stockQty > line.qty) {
        throw new BadRequestException(`${line.description ?? 'Item'}: from-shop quantity must be between 0 and ${line.qty}`);
      }
      const source = requested[i]?.supplierSource?.trim();
      return { stockQty, supplierSource: stockQty < line.qty && source ? source : null };
    });
  }

  // What can actually be sold is what sits in real inventory batches — that is what consumeFifo
  // draws from — so this checks the same thing, not product.stockQuantity.
  async findShortfalls(lines: { productId: string | null; qty: number; description?: string }[]) {
    const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id))];
    if (ids.length === 0) return [];
    const [products, batchSums] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: ids } } }),
      this.prisma.inventoryBatch.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, remainingQuantity: { gt: 0 } },
        _sum: { remainingQuantity: true },
      }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const availableById = new Map(batchSums.map((b) => [b.productId, b._sum.remainingQuantity || 0]));
    const demand = new Map<string, number>();
    for (const line of lines) {
      if (!line.productId) continue;
      demand.set(line.productId, (demand.get(line.productId) || 0) + line.qty);
    }
    const shortfalls: { productId: string; name: string; requested: number; available: number; shortfall: number }[] = [];
    for (const [productId, requested] of demand) {
      const product = byId.get(productId);
      if (!product) continue;
      const available = availableById.get(productId) || 0;
      if (available < requested) {
        shortfalls.push({
          productId,
          name: product.displayName ?? product.name,
          requested,
          available,
          shortfall: requested - available,
        });
      }
    }
    return shortfalls;
  }

  // Change the customer left with the shop.
  private async depositChange(tx: any, customerId: string, amount: number, documentId: string, actorId: string, detail?: string) {
    if (amount <= 0) return;
    await tx.customerLedgerEntry.create({
      data: { customerId, type: LedgerEntryType.CHANGE_DEPOSIT, amount: -amount, documentId, note: detail ? `Excess left with the shop (${detail})` : 'Change left with the shop', createdById: actorId },
    });
    await tx.customer.update({ where: { id: customerId }, data: { creditBalance: { decrement: amount } } });
  }

  // Spends credit the customer already left with the shop.
  private async spendCredit(tx: any, customerId: string, amount: number, documentId: string, actorId: string) {
    if (amount <= 0) return;
    const taken = await tx.customer.updateMany({
      where: { id: customerId, creditBalance: { lte: -amount } },
      data: { creditBalance: { increment: amount } },
    });
    if (taken.count === 0) throw new BadRequestException('This customer does not have that much credit left');
    await tx.customerLedgerEntry.create({
      data: { customerId, type: LedgerEntryType.CREDIT_APPLIED, amount, documentId, note: 'Credit used on a sale', createdById: actorId },
    });
  }

  async priceQuoteInput(actorId: string, actorRole: Role, input: CreateDocumentInput) {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestException('A document needs at least one item');
    }

    const productIds = [...new Set(input.items.map((i) => i.productId).filter((id): id is string => !!id))];
    const products = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } } }) : [];
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new NotFoundException(`Product ${id} not found`);
    }

    const actor = actorRole !== Role.ADMIN ? await this.prisma.user.findUnique({ where: { id: actorId } }) : null;

    const businessSettings = await this.settings.get();
    const priced = this.priceDocumentLines(
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

    return this.applyTotalDiscount(priced, input.discount, actorRole, actor);
  }

  async create(createdById: string, actorRole: Role, input: CreateDocumentInput) {
    const { lines, subtotalAtNegotiatedPrice, roundingAdjustmentTotal, total, discount, transportMode } = await this.priceQuoteInput(createdById, actorRole, input);

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
          discount,
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

  // Edit a quote in place.
  async update(id: string, actorId: string, actorRole: Role, input: CreateDocumentInput) {
    const existing = await this.findOne(id);
    if (existing.type !== DocumentType.QUOTE) {
      throw new BadRequestException('Only quotes can be edited');
    }
    if (existing.status === DocumentStatus.CANCELLED) {
      throw new BadRequestException('A cancelled quote cannot be edited');
    }
    if (existing.status !== DocumentStatus.QUOTED) {
      throw new BadRequestException('Only a quote that has not been invoiced can be edited — cancel it and issue a new one instead');
    }

    const { lines, subtotalAtNegotiatedPrice, roundingAdjustmentTotal, total, discount, transportMode } = await this.priceQuoteInput(actorId, actorRole, input);

    await this.prisma.$transaction(async (tx) => {
      // The status condition is what makes this safe against a quote being converted or cancelled
      // in another tab between the check above and now: if it moved on, nothing matches and nothing
      // is written.
      const claimed = await tx.document.updateMany({
        where: { id, type: DocumentType.QUOTE, status: DocumentStatus.QUOTED },
        data: {
          customerId: input.customerId || null,
          customerName: input.customerName?.trim() || null,
          transportMode,
          transportAmount: input.transportAmount || 0,
          roundingAdjustment: roundingAdjustmentTotal,
          subtotal: subtotalAtNegotiatedPrice,
          discount,
          total,
          notes: input.notes?.trim() || null,
        },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('This quote was changed by someone else while you were editing — reopen it and try again');
      }
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      await tx.documentItem.createMany({ data: lines.map((l) => ({ ...l, documentId: id })) });
    });

    const deliveryNotesIssued = await this.prisma.document.count({ where: { sourceDocumentId: id, type: DocumentType.DELIVERY_NOTE } });
    await this.audit.log({
      actorId,
      action: 'document.quote_edited',
      entityType: 'Document',
      entityId: id,
      metadata: {
        quoteNumber: existing.quoteNumber,
        previousTotal: existing.total,
        total,
        previousItemCount: existing.items.length,
        itemCount: lines.length,
        deliveryNotesIssued,
      },
    });

    return this.findOne(id);
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { unit: true } } } },
        payments: true,
        customer: true,
        createdBy: { select: { name: true } },
        sourceDocument: { select: { id: true, receiptNumber: true, invoiceNumber: true, quoteNumber: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  // A delivery note is its own frozen document (brief step 7), not a live view of the invoice/quote
  // it came from — copies items/customer/transport at the moment it's created so it survives the
  // source document changing status later (e.g.
  async createDeliveryNote(sourceId: string, actorId: string, deliveryLocation?: string, deliveryPhone?: string) {
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
          // A delivery note is a dispatch document: it carries what leaves the yard, never what it cost.
          transportMode: TransportMode.NONE,
          transportAmount: 0,
          roundingAdjustment: 0,
          subtotal: 0,
          total: 0,
          notes: source.notes,
          sourceDocumentId: source.id,
          deliveryNoteNumber,
          deliveryLocation: deliveryLocation?.trim() || null,
          deliveryPhone: deliveryPhone?.trim() || null,
          items: {
            create: source.items.map((i) => ({
              productId: i.productId,
              description: i.description,
              qty: i.qty,
              basePrice: 0,
              unitPrice: 0,
              discount: 0,
              lineTotal: 0,
              transportAllocated: 0,
              roundingAdjustment: 0,
              // What the driver collects where: carried over so the note says which part is loaded
              // here and which comes from elsewhere.
              stockQty: i.stockQty,
              supplierSource: i.supplierSource,
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

  async findAll(params: Parameters<DocumentsService['findPage']>[0]) {
    return (await this.findPage(params)).rows;
  }

  async findPage(params: { statuses?: DocumentStatus[]; type?: DocumentType; from?: string; to?: string; search?: string; sort?: string; limit?: number; offset?: number }) {
    const { statuses, type, from, to, search, sort, limit, offset } = params;
    const term = search?.trim();
    const where = {
      // Suspended orders are parked carts, not documents — they only ever surface through the POS
      // "on hold" list, never in quotes/invoices.
      ...(statuses && statuses.length > 0 ? { status: statuses.length === 1 ? statuses[0] : { in: statuses } } : { status: { not: DocumentStatus.SUSPENDED } }),
      ...(type ? { type } : {}),
      ...(term
        ? {
            OR: [
              { receiptNumber: { contains: term, mode: 'insensitive' as const } },
              { invoiceNumber: { contains: term, mode: 'insensitive' as const } },
              { quoteNumber: { contains: term, mode: 'insensitive' as const } },
              { customerName: { contains: term, mode: 'insensitive' as const } },
              { customer: { is: { name: { contains: term, mode: 'insensitive' as const } } } },
              { customer: { is: { businessName: { contains: term, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: endOfDay(to) } : {}),
            },
          }
        : {}),
    };
    const [rows, counted] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { customer: true, createdBy: { select: { name: true } }, items: true },
        orderBy: orderByFor(sort),
        ...(limit ? { take: limit, skip: offset ?? 0 } : {}),
      }),
      limit ? this.prisma.document.count({ where }) : Promise.resolve(null),
    ]);
    return { rows, total: counted ?? rows.length };
  }

  // Quote -> Invoice is a status change on the SAME record.
  async convertToInvoice(
    id: string,
    actorId: string,
    allowNegativeStock = false,
    fulfilmentInput: { itemId: string; stockQty: number; supplierSource?: string }[] = [],
  ) {
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

    const itemIds = new Set(doc.items.map((i) => i.id));
    const byItem = new Map<string, { stockQty?: number; supplierSource?: string }>();
    for (const f of fulfilmentInput) {
      if (!itemIds.has(f.itemId)) throw new BadRequestException('That line is not part of this quote');
      byItem.set(f.itemId, f);
    }
    const fulfilment = this.resolveFulfilment(
      doc.items.map((i) => ({ productId: i.productId, qty: i.qty, description: i.description })),
      doc.items.map((i) => byItem.get(i.id)),
    );

    // Checked up front so the operator gets the same structured confirmation dialog the POS shows,
    // rather than a transaction blowing up mid-way.
    if (!allowNegative) {
      const missing = await this.findShortfalls(doc.items.map((i, idx) => ({ productId: i.productId, qty: fulfilment[idx].stockQty ?? i.qty, description: i.description })));
      if (missing.length > 0) throw this.insufficientStock(missing);
    }

    const shortfalls: { productId: string; name: string; shortfall: number }[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.settings.nextNumber('INVOICE', tx);
      const result = await tx.document.update({
        where: { id },
        data: { type: DocumentType.INVOICE, status: DocumentStatus.INVOICED, invoicedAt: new Date(), invoiceNumber },
      });

      for (const [idx, item] of doc.items.entries()) {
        if (!item.productId) continue;
        const { stockQty, supplierSource } = fulfilment[idx];
        await tx.documentItem.update({ where: { id: item.id }, data: { stockQty, supplierSource } });
        if (!stockQty) continue;
        const { shortfall } = await this.inventory.consumeFifo(item.productId, stockQty, 'SALE', actorId, `Invoice ${doc.id}`, allowNegative, tx);
        if (shortfall > 0) {
          shortfalls.push({ productId: item.productId, name: item.product?.displayName ?? item.product?.name ?? item.description, shortfall });
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

    await this.auditExternalSupply(actorId, id, doc.items, fulfilment);

    return updated;
  }

  async markPaid(
    id: string,
    actorId: string,
    actorRole: Role,
    input: { paymentMethod?: 'CASH' | 'MPESA'; payments?: TenderInput[]; changeAction?: 'GIVE' | 'CREDIT'; discount?: number } = {},
  ) {
    let doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.INVOICED) {
      throw new BadRequestException('Only an invoiced document can be marked paid');
    }

    // Settling for less than the invoice: the discount is re-set against the pre-discount bill, and a
    // credit customer's ledger (already charged the old total) is corrected by the difference.
    const previousDiscount = doc.discount;
    const newDiscount = input.discount ?? previousDiscount;
    if (newDiscount !== previousDiscount) {
      const gross = doc.total + previousDiscount;
      const actor = actorRole !== Role.ADMIN ? await this.prisma.user.findUnique({ where: { id: actorId } }) : null;
      const priced = this.applyTotalDiscount(
        {
          total: gross,
          subtotalAtListPrice: doc.items.reduce((s, i) => s + i.basePrice * i.qty, 0),
          impliedDiscountTotal: doc.items.reduce((s, i) => s + i.discount, 0),
        },
        newDiscount,
        actorRole,
        actor,
      );
      const change = priced.total - doc.total;
      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.document.updateMany({
          where: { id, status: DocumentStatus.INVOICED, total: doc.total },
          data: { discount: newDiscount, total: priced.total },
        });
        if (moved.count === 0) throw new BadRequestException('This invoice changed while you were settling it — reopen it and try again');
        if (doc.customerId && doc.customer?.isCredit) {
          await tx.customerLedgerEntry.create({
            data: { customerId: doc.customerId, type: LedgerEntryType.ADJUSTMENT, amount: change, documentId: id, note: 'Discount on settlement', createdById: actorId },
          });
          await tx.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { increment: change } } });
        }
      });
      await this.audit.log({
        actorId,
        action: 'document.settled_with_discount',
        entityType: 'Document',
        entityId: id,
        metadata: { previousTotal: doc.total, total: priced.total, discount: newDiscount },
      });
      doc = await this.findOne(id);
    }

    // Older callers only say "paid"; with nothing stated, whatever was already recorded is kept and
    // no payment rows are written.
    const stated = !!(input.payments?.length || input.paymentMethod);
    const settled = stated ? settlePayments(doc.total, input.payments, input.paymentMethod, input.changeAction, !!doc.customerId) : null;

    return this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.settings.nextNumber('RECEIPT', tx);
      const updated = await tx.document.update({
        where: { id },
        data: {
          type: DocumentType.RECEIPT,
          status: DocumentStatus.PAID,
          paidAt: new Date(),
          receiptNumber,
          ...(settled
            ? {
                paymentMethod: settled.paymentMethod,
                changeGiven: settled.changeGiven,
                changeToCredit: settled.changeToCredit,
                payments: { create: settled.rows },
              }
            : {}),
        },
      });

      if (doc.customerId && doc.customer?.isCredit) {
        await tx.customerLedgerEntry.create({
          data: { customerId: doc.customerId, type: LedgerEntryType.PAYMENT, amount: -doc.total, documentId: doc.id, note: 'Invoice paid in full', createdById: actorId },
        });
        await tx.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { decrement: doc.total } } });
      }

      if (settled && doc.customerId) await this.depositChange(tx, doc.customerId, settled.changeToCredit, id, actorId, settled.surplusDetail);

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

  // Quotes that were only ever a price check are clutter once cancelled, so a cancelled quote can
  // be removed for good.
  async deleteCancelledQuote(id: string, actorId: string) {
    const doc = await this.findOne(id);
    if (doc.status !== DocumentStatus.CANCELLED) {
      throw new BadRequestException('Cancel the quote first — only a cancelled quote can be deleted');
    }
    if (doc.type !== DocumentType.QUOTE || doc.invoicedAt) {
      throw new BadRequestException('Only a quote that was never invoiced can be deleted');
    }
    const deliveryNotes = await this.prisma.document.count({ where: { sourceDocumentId: id } });
    if (deliveryNotes > 0) {
      throw new BadRequestException('A delivery note was raised from this quote, so it is kept on record');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      await tx.document.delete({ where: { id } });
    });

    await this.audit.log({
      actorId,
      action: 'document.quote_deleted',
      entityType: 'Document',
      entityId: id,
      metadata: {
        quoteNumber: doc.quoteNumber,
        total: doc.total,
        customer: doc.customer?.businessName || doc.customer?.name || doc.customerName,
        items: doc.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice })),
      },
    });
    return { id };
  }

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

  // The POS checkout path (brief §14-17, §27, §59).
  async posSale(actorId: string, actorRole: Role, input: CreatePosSaleDto) {
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new NotFoundException(`Product ${id} not found`);
    }

    // --- Discount limit (brief §24 — enforced here, never trusted from the frontend) --- Fetched
    // once for both the discount-limit and stock-override checks below.
    const actor = actorRole !== Role.ADMIN ? await this.prisma.user.findUnique({ where: { id: actorId } }) : null;

    const canOverrideStock = actorRole === Role.ADMIN || !!actor?.canInvoiceWithoutStock;
    if (input.allowNegativeStock && !canOverrideStock) {
      throw new ForbiddenException('You are not authorized to invoice against stock the system does not have recorded');
    }
    const allowNegative = !!input.allowNegativeStock && canOverrideStock;
    // Only the part leaving the shop's own stock has to be on the shelf.
    const fulfilment = this.resolveFulfilment(
      input.items.map((i) => ({ productId: i.productId, qty: i.qty, description: productMap.get(i.productId)?.displayName ?? productMap.get(i.productId)?.name })),
      input.items,
    );
    if (!allowNegative) {
      const missing = await this.findShortfalls(input.items.map((i, idx) => ({ productId: i.productId, qty: fulfilment[idx].stockQty ?? i.qty })));
      if (missing.length > 0) throw this.insufficientStock(missing);
    }

    // --- Customer --- The till settles in full, by M-Pesa Paybill or cash.
    if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    // --- Per-line pricing: negotiated price -> (+transport if folded) -> commercial rounding
    // (brief §14-17, §59) --
    const businessSettings = await this.settings.get();
    const roundingIncrement = input.roundingIncrement || businessSettings.roundingIncrement;
    const {
      lines: computedLines,
      subtotalAtNegotiatedPrice: subtotal,
      subtotalAtListPrice,
      impliedDiscountTotal,
      roundingAdjustmentTotal,
      total: totalBeforeDiscount,
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

    const { total, discount } = this.applyTotalDiscount(
      { total: totalBeforeDiscount, subtotalAtListPrice, impliedDiscountTotal },
      input.discount,
      actorRole,
      actor,
    );

    const saleShortfalls: { productId: string; name: string; shortfall: number }[] = [];
    if (input.settleLater && input.creditApplied) {
      throw new BadRequestException('Credit can’t be used on a pay-later sale — settle it from the invoice instead');
    }
    const settled = input.settleLater
      ? null
      : settlePayments(total, input.payments, input.paymentMethod, input.changeAction, !!input.customerId, input.creditApplied);
    const settleLater = !!input.settleLater;
    const type = settleLater ? DocumentType.INVOICE : DocumentType.RECEIPT;
    const status = settleLater ? DocumentStatus.INVOICED : DocumentStatus.PAID;
    const now = new Date();

    const doc = await this.prisma.$transaction(async (tx) => {
      const number = settleLater ? await this.settings.nextNumber('INVOICE', tx) : await this.settings.nextNumber('RECEIPT', tx);

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
          paymentMethod: settled ? settled.paymentMethod : null,
          changeGiven: settled?.changeGiven ?? 0,
          changeToCredit: settled?.changeToCredit ?? 0,
          creditApplied: settled?.creditApplied ?? 0,
          payments: settled ? { create: settled.rows } : undefined,
          subtotal,
          discount,
          total,
          notes: input.notes,
          invoicedAt: settleLater ? now : undefined,
          paidAt: settleLater ? undefined : now,
          invoiceNumber: settleLater ? number : undefined,
          receiptNumber: settleLater ? undefined : number,
          items: { create: computedLines.map((l, i) => ({ ...l, stockQty: fulfilment[i].stockQty, supplierSource: fulfilment[i].supplierSource })) },
        },
      });

      // Consume real stock, oldest cost lot first — inside this same transaction.
      for (const [idx, line] of computedLines.entries()) {
        const fromShop = fulfilment[idx].stockQty ?? 0;
        if (!line.productId || fromShop <= 0) continue;
        const { shortfall } = await this.inventory.consumeFifo(line.productId, fromShop, 'SALE', actorId, `Sale ${created.id}`, allowNegative, tx);
        if (shortfall > 0) {
          saleShortfalls.push({ productId: line.productId, name: line.description, shortfall });
        }
      }

      if (settled && input.customerId) {
        await this.spendCredit(tx, input.customerId, settled.creditApplied, created.id, actorId);
        await this.depositChange(tx, input.customerId, settled.changeToCredit, created.id, actorId, settled.surplusDetail);
      }

      if (input.suspendedFromId) {
        const held = await tx.document.findUnique({ where: { id: input.suspendedFromId } });
        if (held && held.status === DocumentStatus.SUSPENDED) {
          await tx.documentItem.deleteMany({ where: { documentId: held.id } });
          await tx.document.delete({ where: { id: held.id } });
        }
      }

      return tx.document.findUnique({
        where: { id: created.id },
        include: { items: { include: { product: true } }, payments: true, customer: true, createdBy: { select: { name: true } } },
      });
    });

    await this.audit.log({
      actorId,
      action: 'documents.pos_sale',
      entityType: 'Document',
      entityId: doc!.id,
      metadata: {
        total,
        paymentMethod: settled ? settled.paymentMethod : 'SETTLE_LATER',
        payments: settled?.rows,
        changeGiven: settled?.changeGiven,
        changeToCredit: settled?.changeToCredit,
        creditApplied: settled?.creditApplied,
        itemCount: input.items.length,
      },
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

    await this.auditExternalSupply(actorId, doc!.id, computedLines, fulfilment);

    return doc;
  }

  // Leaves a trail of what was sold but not taken from the shop, since that part is invisible to inventory.
  private async auditExternalSupply(
    actorId: string,
    documentId: string,
    lines: { productId: string | null; description: string; qty: number }[],
    fulfilment: { stockQty: number | null; supplierSource: string | null }[],
  ) {
    const external = lines
      .map((l, i) => ({ productId: l.productId, name: l.description, qty: l.qty - (fulfilment[i].stockQty ?? l.qty), source: fulfilment[i].supplierSource }))
      .filter((l) => l.productId && l.qty > 0);
    if (external.length === 0) return;
    await this.audit.log({
      actorId,
      action: 'document.supplied_externally',
      entityType: 'Document',
      entityId: documentId,
      metadata: { lines: external },
    });
  }

  // --- Suspended (parked) POS orders ------------------------------------- Reuses the existing
  // Document record rather than a parallel order table: same items, same customer, same transport
  // figure.
  async suspendOrder(
    actorId: string,
    input: {
      customerId?: string;
      customerName?: string;
      label?: string;
      items: { productId: string; qty: number; unitPrice: number }[];
      transportAmount?: number;
      foldTransportIntoPrices?: boolean;
    },
  ) {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestException('There is nothing to suspend');
    }

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new NotFoundException(`Product ${id} not found`);
    }

    const transportAmount = input.transportAmount || 0;
    const doc = await this.prisma.document.create({
      data: {
        type: DocumentType.QUOTE,
        status: DocumentStatus.SUSPENDED,
        customerId: input.customerId,
        customerName: input.customerName,
        createdById: actorId,
        // Only the amount and whether it folds survive a suspend; the precise per-line allocation
        // is recalculated at checkout anyway.
        transportMode: transportAmount > 0 ? (input.foldTransportIntoPrices === false ? TransportMode.ITEMIZED : TransportMode.DISTRIBUTED) : TransportMode.NONE,
        transportAmount,
        subtotal: input.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0),
        total: input.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0) + transportAmount,
        notes: input.label,
        items: {
          create: input.items.map((i) => {
            const product = productMap.get(i.productId)!;
            return {
              productId: i.productId,
              description: product.displayName ?? product.name,
              qty: i.qty,
              basePrice: product.basePrice,
              unitPrice: i.unitPrice,
              lineTotal: i.qty * i.unitPrice,
            };
          }),
        },
      },
      include: { items: { include: { product: { include: { unit: true } } } }, customer: true, createdBy: { select: { name: true } } },
    });

    await this.audit.log({
      actorId,
      action: 'documents.order_suspended',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { itemCount: input.items.length, label: input.label },
    });

    return doc;
  }

  listSuspended() {
    return this.prisma.document.findMany({
      where: { status: DocumentStatus.SUSPENDED },
      include: { items: { include: { product: { include: { unit: true } } } }, customer: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async discardSuspended(id: string, actorId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Suspended order not found');
    if (doc.status !== DocumentStatus.SUSPENDED) {
      throw new BadRequestException('Only a suspended order can be discarded');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      await tx.document.delete({ where: { id } });
    });

    await this.audit.log({
      actorId,
      action: 'documents.suspended_order_discarded',
      entityType: 'Document',
      entityId: id,
      metadata: { total: doc.total },
    });

    return { id };
  }
}