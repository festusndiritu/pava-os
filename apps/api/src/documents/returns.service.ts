import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, LedgerEntryType, PaymentMethod } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { CreateReturnDto } from './dto/return.dto.js';

/**
 * A return never mutates the sale it came from. The original Document stays
 * exactly as it was issued; each return is its own record pointing at the
 * document lines being given back, so a sale can be returned against more
 * than once and the history of who returned what, when, survives.
 */
@Injectable()
export class ReturnsService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  /**
   * The document's lines with sold / already-returned / still-returnable
   * quantities — what the POS return screen is built from. Returnable is
   * always (sold − already returned), so two returns can never give back
   * more than was bought.
   */
  async returnable(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        items: { include: { product: { include: { unit: true } } } },
        customer: true,
        returns: { include: { items: true } },
      },
    });
    if (!doc) throw new NotFoundException('Sale not found');
    if (doc.type === DocumentType.DELIVERY_NOTE) {
      throw new BadRequestException('A delivery note is not a sale — open the invoice or receipt it came from');
    }
    if (doc.status !== DocumentStatus.PAID && doc.status !== DocumentStatus.INVOICED) {
      throw new BadRequestException('Only a completed sale can be returned against');
    }

    const returnedByItem = new Map<string, number>();
    for (const ret of doc.returns) {
      for (const line of ret.items) {
        returnedByItem.set(line.documentItemId, (returnedByItem.get(line.documentItemId) || 0) + line.qty);
      }
    }

    return {
      id: doc.id,
      type: doc.type,
      status: doc.status,
      receiptNumber: doc.receiptNumber,
      invoiceNumber: doc.invoiceNumber,
      paymentMethod: doc.paymentMethod,
      customerLabel: doc.customer?.businessName || doc.customer?.name || doc.customerName || 'Walk-in customer',
      createdAt: doc.createdAt,
      total: doc.total,
      items: doc.items.map((item) => {
        const returned = returnedByItem.get(item.id) || 0;
        return {
          documentItemId: item.id,
          productId: item.productId,
          description: item.description,
          unit: item.product?.unit?.symbol ?? null,
          unitPrice: item.unitPrice,
          qtySold: item.qty,
          qtyReturned: returned,
          qtyReturnable: Math.max(0, item.qty - returned),
        };
      }),
      returns: doc.returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        total: r.total,
        refundMethod: r.refundMethod,
        createdAt: r.createdAt,
        itemCount: r.items.length,
      })),
    };
  }

  async create(documentId: string, actorId: string, input: CreateReturnDto) {
    const snapshot = await this.returnable(documentId);

    const lines = (input.items || []).filter((line) => line.qty > 0);
    if (lines.length === 0) throw new BadRequestException('Select at least one item to return');

    const byItemId = new Map(snapshot.items.map((i) => [i.documentItemId, i]));
    // Guard the sum, not each line on its own — the same document line can
    // only be listed once, and never beyond what is still returnable.
    const requested = new Map<string, number>();
    for (const line of lines) {
      const item = byItemId.get(line.documentItemId);
      if (!item) throw new BadRequestException('That item is not part of this sale');
      requested.set(line.documentItemId, (requested.get(line.documentItemId) || 0) + line.qty);
    }
    for (const [documentItemId, qty] of requested) {
      const item = byItemId.get(documentItemId)!;
      if (qty > item.qtyReturnable + 0.0001) {
        throw new BadRequestException(
          `${item.description}: only ${item.qtyReturnable} of ${item.qtySold} can still be returned`,
        );
      }
    }

    const returnLines = [...requested.entries()].map(([documentItemId, qty]) => {
      const item = byItemId.get(documentItemId)!;
      return {
        documentItemId,
        productId: item.productId,
        description: item.description,
        qty,
        unitPrice: item.unitPrice,
        lineTotal: qty * item.unitPrice,
      };
    });
    const total = returnLines.reduce((sum, l) => sum + l.lineTotal, 0);

    // An account sale is refunded to the customer's ledger, not out of the
    // till; a cash/M-Pesa sale is refunded by the same route it was paid.
    const onAccount = snapshot.paymentMethod === PaymentMethod.CREDIT;
    const refundMethod = onAccount ? null : ((input.refundMethod as PaymentMethod) ?? (snapshot.paymentMethod as PaymentMethod) ?? PaymentMethod.CASH);

    const created = await this.prisma.$transaction(async (tx) => {
      const returnNumber = await this.settings.nextNumber('RETURN', tx);
      const record = await tx.return.create({
        data: {
          returnNumber,
          documentId,
          total,
          refundMethod,
          reason: input.reason,
          createdById: actorId,
          items: { create: returnLines },
        },
        include: { items: true },
      });

      for (const line of returnLines) {
        if (!line.productId) continue;
        await this.inventory.restock(line.productId, line.qty, actorId, `Return ${returnNumber}`, tx);
      }

      if (onAccount) {
        const doc = await tx.document.findUnique({ where: { id: documentId }, include: { customer: true } });
        if (doc?.customerId && doc.customer?.isCredit) {
          await tx.customerLedgerEntry.create({
            data: {
              customerId: doc.customerId,
              type: LedgerEntryType.REFUND,
              amount: -total,
              documentId,
              note: `Return ${returnNumber}`,
              createdById: actorId,
            },
          });
          await tx.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { decrement: total } } });
        }
      }

      return record;
    });

    await this.audit.log({
      actorId,
      action: 'documents.return_created',
      entityType: 'Document',
      entityId: documentId,
      metadata: { returnNumber: created.returnNumber, total, itemCount: returnLines.length, refundMethod },
    });

    return created;
  }

  findOne(id: string) {
    return this.prisma.return.findUnique({
      where: { id },
      include: { items: true, document: { include: { customer: true } }, createdBy: { select: { name: true } } },
    });
  }

  list(limit = 50) {
    return this.prisma.return.findMany({
      include: { items: true, document: { select: { id: true, receiptNumber: true, invoiceNumber: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}