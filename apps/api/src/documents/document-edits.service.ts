import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, EditRequestStatus, LedgerEntryType, PaymentMethod, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DocumentsService } from './documents.service.js';
import type { CreateEditRequestDto, DecideEditRequestDto } from './dto/edit-request.dto.js';

type Settlement = 'CASH' | 'MPESA' | 'CREDIT';

@Injectable()
export class DocumentEditsService {
  constructor(
    private prisma: PrismaService,
    private documents: DocumentsService,
    private inventory: InventoryService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private async labelOf(documentId: string) {
    const d = await this.prisma.document.findUnique({ where: { id: documentId }, select: { receiptNumber: true, invoiceNumber: true } });
    return d?.receiptNumber ?? d?.invoiceNumber ?? 'a sale';
  }

  // Why a document can't be corrected at all.
  private async assertEditable(id: string) {
    const doc = await this.documents.findOne(id);
    if (doc.type === DocumentType.DELIVERY_NOTE) throw new BadRequestException('A delivery note cannot be edited');
    if (doc.status !== DocumentStatus.INVOICED && doc.status !== DocumentStatus.PAID) {
      throw new BadRequestException('Only an issued invoice or receipt needs an approved edit — quotes can be edited directly');
    }
    const returns = await this.prisma.return.count({ where: { documentId: id } });
    if (returns > 0) {
      throw new BadRequestException('Returns have already been recorded against this sale, so it can no longer be edited');
    }
    if (doc.status === DocumentStatus.PAID && doc.customer?.isCredit) {
      throw new BadRequestException('A paid sale on a customer account cannot be edited yet — record a return or an adjustment on the account instead');
    }
    return doc;
  }

  async request(documentId: string, actorId: string, actorRole: Role, input: CreateEditRequestDto) {
    const doc = await this.assertEditable(documentId);

    const pending = await this.prisma.documentEditRequest.count({ where: { documentId, status: EditRequestStatus.PENDING } });
    if (pending > 0) throw new BadRequestException('There is already an edit waiting for approval on this document');

    const known = new Set(doc.items.map((i) => i.id));
    for (const item of input.items) {
      if (item.itemId && !known.has(item.itemId)) throw new BadRequestException('One of the lines is not part of this document');
    }

    // Priced by the same rules as a new sale — including the requester's own discount limit — so
    // the proposed total is exactly what approval applies.
    const priced = await this.documents.priceQuoteInput(actorId, actorRole, { ...input, discount: doc.discount });
    if (priced.total === doc.total && !this.linesDiffer(doc, priced.lines)) {
      throw new BadRequestException('Nothing would change — adjust a quantity, price or the transport first');
    }

    const created = await this.prisma.documentEditRequest.create({
      data: {
        documentId,
        reason: input.reason.trim(),
        // The proposal itself, plus a readable before/after so whoever approves it can see what is
        // changing without re-deriving it.
        changes: {
          ...input,
          before: doc.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
          before_transport: doc.transportAmount,
          after: priced.lines.map((l) => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
        } as any,
        previousTotal: doc.total,
        proposedTotal: priced.total,
        requestedById: actorId,
      },
    });

    await this.audit.log({
      actorId,
      action: 'document.edit_requested',
      entityType: 'Document',
      entityId: documentId,
      metadata: { requestId: created.id, previousTotal: doc.total, proposedTotal: priced.total, reason: created.reason },
    });

    const requester = await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
    await this.notifications.notifyAdmins(
      {
        kind: 'edit_requested',
        title: 'Edit waiting for your approval',
        body: `${requester?.name ?? 'Staff'} wants to change ${doc.receiptNumber ?? doc.invoiceNumber ?? 'a sale'} (KSh ${doc.total.toLocaleString('en-KE')} → KSh ${priced.total.toLocaleString('en-KE')}): ${created.reason}`,
        url: '/invoices?approvals=1',
        entityType: 'DocumentEditRequest',
        entityId: created.id,
      },
      actorId,
    );
    return created;
  }

  private linesDiffer(doc: { items: { productId: string | null; qty: number; unitPrice: number; description: string }[]; transportAmount: number }, lines: { productId: string | null; qty: number; unitPrice: number; description: string }[]) {
    if (doc.items.length !== lines.length) return true;
    return lines.some((l, i) => l.productId !== doc.items[i].productId || l.qty !== doc.items[i].qty || l.unitPrice !== doc.items[i].unitPrice || l.description !== doc.items[i].description);
  }

  list(params: { status?: EditRequestStatus; documentId?: string } = {}) {
    return this.prisma.documentEditRequest.findMany({
      where: { ...(params.status ? { status: params.status } : {}), ...(params.documentId ? { documentId: params.documentId } : {}) },
      include: {
        requestedBy: { select: { name: true } },
        decidedBy: { select: { name: true } },
        document: { select: { id: true, type: true, status: true, invoiceNumber: true, receiptNumber: true, customerName: true, customer: { select: { name: true, businessName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async afterDecision(req: { id: string; documentId: string; requestedById: string }, actorId: string, approved: boolean, note?: string) {
    await this.notifications.resolveEntity('DocumentEditRequest', req.id);
    if (req.requestedById === actorId) return;
    const label = await this.labelOf(req.documentId);
    await this.notifications.notifyUsers([req.requestedById], {
      kind: approved ? 'edit_approved' : 'edit_rejected',
      title: approved ? 'Your edit was approved' : 'Your edit was rejected',
      body: `${label}${note?.trim() ? `: ${note.trim()}` : ''}`,
      url: `/invoices?open=${req.documentId}`,
      entityType: 'Document',
      entityId: req.documentId,
    });
  }

  async reject(requestId: string, actorId: string, input: DecideEditRequestDto) {
    const req = await this.prisma.documentEditRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Edit request not found');
    if (req.status !== EditRequestStatus.PENDING) throw new BadRequestException('This request has already been decided');

    const updated = await this.prisma.documentEditRequest.update({
      where: { id: requestId },
      data: { status: EditRequestStatus.REJECTED, decidedById: actorId, decidedAt: new Date(), decisionNote: input.note?.trim() || null },
    });
    await this.audit.log({ actorId, action: 'document.edit_rejected', entityType: 'Document', entityId: req.documentId, metadata: { requestId, note: input.note } });
    await this.afterDecision(req, actorId, false, input.note);
    return updated;
  }

  async approve(requestId: string, actorId: string, actorRole: Role, input: DecideEditRequestDto) {
    if (actorRole !== Role.ADMIN) throw new ForbiddenException('Only an admin can approve an edit');

    const req = await this.prisma.documentEditRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Edit request not found');
    if (req.status !== EditRequestStatus.PENDING) throw new BadRequestException('This request has already been decided');

    const doc = await this.assertEditable(req.documentId);
    if (doc.total !== req.previousTotal) {
      throw new BadRequestException('This document changed after the edit was requested — reject it and ask for a fresh request');
    }

    const changes = req.changes as unknown as CreateEditRequestDto;
    // Re-priced as the approving admin (no discount cap): the admin's sign-off is the override.
    const priced = await this.documents.priceQuoteInput(actorId, actorRole, { ...changes, discount: doc.discount });
    if (priced.total !== req.proposedTotal) {
      throw new BadRequestException('Prices or rounding settings changed since this was requested — reject it and ask for a fresh request');
    }

    const diff = priced.total - doc.total;
    const settlement = input.settlement as Settlement | undefined;
    if (doc.status === DocumentStatus.PAID && diff !== 0) {
      if (!settlement) {
        throw new BadRequestException(diff > 0 ? 'Choose how the extra KSh ' + diff + ' was collected' : 'Choose how the KSh ' + -diff + ' is given back');
      }
      if (settlement === 'CREDIT' && (diff > 0 || !doc.customerId)) {
        throw new BadRequestException(diff > 0 ? 'Extra money must be collected by cash or M-Pesa' : 'Select a customer on the sale to leave the amount on their credit');
      }
    }

    const oldById = new Map(doc.items.map((i) => [i.id, i]));
    // Lowest from-shop quantity each line can drop to when stock is short: what it already took.
    const floors: number[] = [];
    const nextLines = priced.lines.map((line, idx) => {
      floors[idx] = 0;
      const old = changes.items[idx].itemId ? oldById.get(changes.items[idx].itemId!) : undefined;
      if (!line.productId) return { ...line, stockQty: null as number | null, supplierSource: null as string | null };
      if (!old) return { ...line, stockQty: line.qty, supplierSource: null };
      const oldStock = old.stockQty ?? old.qty;
      floors[idx] = Math.min(oldStock, line.qty);
      const delta = line.qty - old.qty;
      // More units come from the shop; fewer units drop the externally supplied part first, so the
      // shop's own stock isn't over-returned.
      const stockQty = delta >= 0 ? oldStock + delta : line.qty - Math.max(0, old.qty - oldStock + delta);
      return { ...line, stockQty, supplierSource: stockQty < line.qty ? old.supplierSource : null };
    });

    const netStock = () => {
      const net = new Map<string, number>();
      for (const old of doc.items) if (old.productId) net.set(old.productId, (net.get(old.productId) || 0) - (old.stockQty ?? old.qty));
      for (const l of nextLines) if (l.productId) net.set(l.productId, (net.get(l.productId) || 0) + (l.stockQty ?? 0));
      return net;
    };

    // Takes the shortfall off the lines that grew (last line first), never below what they already took.
    const cutPlan = (missing: { productId: string; shortfall: number }[]) => {
      const out = nextLines.map((l) => l.stockQty);
      for (const m of missing) {
        let left = m.shortfall;
        for (let i = nextLines.length - 1; i >= 0 && left > 0; i--) {
          const q = out[i];
          if (nextLines[i].productId !== m.productId || q == null) continue;
          const cut = Math.min(left, q - floors[i]);
          if (cut <= 0) continue;
          out[i] = q - cut;
          left -= cut;
        }
      }
      return out;
    };
    const stockShortfalls = async () => {
      const need = [...netStock().entries()].filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
      return need.length > 0 ? this.documents.findShortfalls(need) : [];
    };
    const refuse = (missing: Awaited<ReturnType<typeof stockShortfalls>>): never => {
      const suggested = cutPlan(missing);
      const short = new Set(missing.map((m) => m.productId));
      throw new BadRequestException({
        statusCode: 400,
        code: 'INSUFFICIENT_STOCK',
        message: `Not enough stock for this edit: ${missing.map((m) => `${m.name} (need ${m.requested}, have ${m.available})`).join(', ')}`,
        shortfalls: missing,
        // Lines the admin can split between the shelf and elsewhere, with the least each can take from the shelf.
        editLines: nextLines.flatMap((l, i) =>
          l.productId && short.has(l.productId) && l.stockQty != null ? [{ index: i, name: l.description, qty: l.qty, min: floors[i], suggested: suggested[i] ?? l.stockQty }] : [],
        ),
      });
    };

    let missing = await stockShortfalls();
    if (missing.length > 0 && !input.allowShortfall) refuse(missing);

    const sourcedElsewhere: { name: string; fromElsewhere: number }[] = [];
    if (input.allowShortfall) {
      const touched = new Set<number>();
      const chosen = input.fulfilment ?? [];
      for (const c of chosen) {
        const l = nextLines[c.index];
        if (!l || !l.productId || l.stockQty == null) throw new BadRequestException('Unknown line in the from-shop choices');
        if (c.stockQty < floors[c.index] || c.stockQty > l.qty) {
          throw new BadRequestException(`${l.description}: from-shop quantity must be between ${floors[c.index]} and ${l.qty}`);
        }
        l.stockQty = c.stockQty;
        touched.add(c.index);
      }
      missing = await stockShortfalls();
      if (missing.length > 0) {
        // The admin asked for more from the shelf than it holds: show the shelf again.
        if (chosen.length > 0) refuse(missing);
        cutPlan(missing).forEach((q, i) => {
          if (q != null && q !== nextLines[i].stockQty) {
            nextLines[i].stockQty = q;
            touched.add(i);
          }
        });
      }
      const source = input.supplierSource?.trim();
      for (const i of touched) {
        const l = nextLines[i];
        if (l.stockQty == null) continue;
        if (l.stockQty < l.qty) {
          l.supplierSource = source || l.supplierSource || 'Backorder';
          sourcedElsewhere.push({ name: l.description, fromElsewhere: l.qty - l.stockQty });
        } else {
          l.supplierSource = null;
        }
      }
    }
    const net = netStock();

    const deliveryNotesIssued = await this.prisma.document.count({ where: { sourceDocumentId: doc.id, type: DocumentType.DELIVERY_NOTE } });
    const before = { total: doc.total, transportAmount: doc.transportAmount, items: doc.items.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice })) };

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.documentEditRequest.updateMany({
        where: { id: requestId, status: EditRequestStatus.PENDING },
        data: { status: EditRequestStatus.APPROVED, decidedById: actorId, decidedAt: new Date(), decisionNote: input.note?.trim() || null },
      });
      if (claimed.count === 0) throw new BadRequestException('This request has already been decided');
      const moved = await tx.document.updateMany({
        where: { id: doc.id, status: doc.status, total: doc.total },
        data: {
          transportMode: priced.transportMode,
          transportAmount: changes.transportAmount || 0,
          roundingAdjustment: priced.roundingAdjustmentTotal,
          subtotal: priced.subtotalAtNegotiatedPrice,
          total: priced.total,
        },
      });
      if (moved.count === 0) throw new BadRequestException('This document changed while the edit was being approved — try again');

      await tx.documentItem.deleteMany({ where: { documentId: doc.id } });
      await tx.documentItem.createMany({ data: nextLines.map((l) => ({ ...l, documentId: doc.id })) });

      for (const [productId, q] of net) {
        if (q > 0) await this.inventory.consumeFifo(productId, q, 'CORRECTION', actorId, `Edit of ${doc.invoiceNumber ?? doc.receiptNumber}`, false, tx);
        else if (q < 0) await this.inventory.restock(productId, -q, actorId, `Edit of ${doc.invoiceNumber ?? doc.receiptNumber}`, tx);
      }

      if (diff !== 0 && doc.status === DocumentStatus.INVOICED && doc.customerId && doc.customer?.isCredit) {
        await tx.customerLedgerEntry.create({
          data: { customerId: doc.customerId, type: LedgerEntryType.ADJUSTMENT, amount: diff, documentId: doc.id, note: 'Invoice corrected', createdById: actorId },
        });
        await tx.customer.update({ where: { id: doc.customerId }, data: { creditBalance: { increment: diff } } });
      }

      if (diff !== 0 && doc.status === DocumentStatus.PAID && settlement) {
        if (settlement === 'CREDIT') {
          await tx.customerLedgerEntry.create({
            data: { customerId: doc.customerId!, type: LedgerEntryType.ADJUSTMENT, amount: diff, documentId: doc.id, note: 'Credit from a corrected sale', createdById: actorId },
          });
          await tx.customer.update({ where: { id: doc.customerId! }, data: { creditBalance: { increment: diff } } });
          await tx.document.update({ where: { id: doc.id }, data: { changeToCredit: { increment: -diff } } });
        } else {
          await tx.documentPayment.create({ data: { documentId: doc.id, method: settlement as PaymentMethod, amount: diff } });
          const rows = await tx.documentPayment.findMany({ where: { documentId: doc.id } });
          const byMethod = new Map<PaymentMethod, number>();
          for (const r of rows) byMethod.set(r.method, (byMethod.get(r.method) || 0) + r.amount);
          const live = [...byMethod.entries()].filter(([, a]) => a > 0).map(([m]) => m);
          await tx.document.update({ where: { id: doc.id }, data: { paymentMethod: live.length > 1 ? PaymentMethod.MIXED : live[0] ?? doc.paymentMethod } });
        }
      }
    });

    await this.audit.log({
      actorId,
      action: 'document.edit_approved',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { requestId, requestedById: req.requestedById, reason: req.reason, before, total: priced.total, difference: diff, settlement, deliveryNotesIssued, sourcedElsewhere },
    });
    await this.afterDecision(req, actorId, true, input.note);

    return this.documents.findOne(doc.id);
  }
}
