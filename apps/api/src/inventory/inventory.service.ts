import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MovementType } from '../../generated/prisma/client.js';

// Simple markup-preserving suggestion for the "update selling price?" prompt
// on receiving (brief §23) — not a general rounding/pricing engine (that's
// its own Settings-driven phase later). Round up to the nearest 5.
function suggestPrice(currentBasePrice: number, previousCost: number | null, newCost: number): number {
  const marginRatio = previousCost && previousCost > 0 ? currentBasePrice / previousCost : 1.12; // ~12% fallback markup
  const raw = newCost * marginRatio;
  return Math.ceil(raw / 5) * 5;
}

interface ReceiveLine {
  productId: string;
  quantity: number;
  unitCost: number;
}

interface AdjustInput {
  productId: string;
  quantity: number; // signed
  type: 'ADJUSTMENT' | 'CORRECTION' | 'RETURN';
  note?: string;
  allowNegative?: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async receive(
    input: { supplier: string; reference?: string; notes?: string; lines: ReceiveLine[] },
    receivedById: string,
  ) {
    if (input.lines.length === 0) throw new BadRequestException('At least one line is required');

    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.inventoryReceipt.create({
        data: {
          supplier: input.supplier,
          reference: input.reference,
          notes: input.notes,
          receivedById,
        },
      });

      const lineResults = [];
      for (const line of input.lines) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) throw new NotFoundException(`Product ${line.productId} not found`);

        const batch = await tx.inventoryBatch.create({
          data: {
            productId: line.productId,
            receiptId: receipt.id,
            quantityReceived: line.quantity,
            remainingQuantity: line.quantity,
            unitCost: line.unitCost,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: line.productId,
            batchId: batch.id,
            type: MovementType.RECEIPT,
            quantity: line.quantity,
            unitCost: line.unitCost,
            createdById: receivedById,
          },
        });

        await tx.product.update({
          where: { id: line.productId },
          data: {
            stockQuantity: { increment: line.quantity },
            lastCost: line.unitCost,
          },
        });

        lineResults.push({
          productId: line.productId,
          productName: product.name,
          batchId: batch.id,
          suggestedPrice: suggestPrice(product.basePrice, product.lastCost, line.unitCost),
          currentPrice: product.basePrice,
        });
      }

      return { receipt, lines: lineResults };
    });

    await this.audit.log({
      actorId: receivedById,
      action: 'inventory.received',
      entityType: 'InventoryReceipt',
      entityId: result.receipt.id,
      metadata: { supplier: input.supplier, lineCount: input.lines.length },
    });

    return result;
  }

  // Draws down real cost lots oldest-first (brief §20). Used for anything
  // that represents real stock actually leaving at cost: sales (once POS
  // wires this in), damage, loss. Throws on insufficient stock unless the
  // caller explicitly authorizes going negative.
  //
  // Accepts an optional `client` (a Prisma transaction client) so callers
  // like DocumentsService.posSale can run this INSIDE their own
  // transaction — finalizing a sale must be one atomic operation (brief
  // §70: validate stock, freeze document lines, consume inventory, all or
  // nothing), not two separate commits that could leave things half-done.
  async consumeFifo(
    productId: string,
    quantity: number,
    type: 'SALE' | 'DAMAGE' | 'LOSS' | 'ADJUSTMENT' | 'CORRECTION',
    createdById: string,
    note?: string,
    allowNegative = false,
    client?: any,
  ) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    const run = async (tx: any) => {
      const batches = await tx.inventoryBatch.findMany({
        where: { productId, remainingQuantity: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      });

      let remaining = quantity;
      let totalCost = 0;
      const consumed: { batchId: string; quantity: number; unitCost: number }[] = [];

      for (const batch of batches) {
        if (remaining <= 0) break;
        const take = Math.min(batch.remainingQuantity, remaining);
        if (take <= 0) continue;

        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { remainingQuantity: { decrement: take } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId,
            batchId: batch.id,
            type: type as MovementType,
            quantity: -take,
            unitCost: batch.unitCost,
            note,
            createdById,
          },
        });

        consumed.push({ batchId: batch.id, quantity: take, unitCost: batch.unitCost });
        totalCost += take * batch.unitCost;
        remaining -= take;
      }

      if (remaining > 0) {
        if (!allowNegative) {
          throw new BadRequestException(
            `Insufficient stock: short by ${remaining} unit(s). Use an authorized adjustment to proceed anyway.`,
          );
        }
        // Authorized shortfall: record what could not be fulfilled from
        // stock as its own movement (for the audit trail and for whoever
        // fulfils the backorder later), but recorded stock is never pushed
        // below zero for it — only the part actually taken off the shelf
        // above is deducted from the product's stockQuantity below.
        await tx.inventoryMovement.create({
          data: { productId, type: type as MovementType, quantity: -remaining, createdById, note: note ?? 'Backorder — sold beyond recorded stock' },
        });
      }

      // Only what was actually consumed from batches comes off stockQuantity
      // — never the full requested amount — so stock floors at zero instead
      // of reading negative when a sale outruns what's on the shelf.
      const consumedQuantity = quantity - remaining;
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: consumedQuantity } },
      });

      return { totalCost, averageCost: totalCost / (consumedQuantity || 1), consumed, shortfall: Math.max(remaining, 0) };
    };

    return client ? run(client) : this.prisma.$transaction(run);
  }

  // Puts stock back on the shelf. Used by the returns flow, which has to run
  // inside the same transaction as the Return record it belongs to, so this
  // takes an optional Prisma transaction client exactly like consumeFifo.
  //
  // This used to just bump stockQuantity with no batch behind it — which
  // looked right everywhere the number is displayed, but left the returned
  // units permanently unsellable, since a sale can only ever draw from a
  // real InventoryBatch. It now opens one, the same lightweight way a
  // manual stock addition does (see adjust() below), costed at the
  // product's last known cost. That isn't necessarily the exact lot the
  // returned unit first left on, but it's a real, current figure rather
  // than a fictional one, and it's what keeps the item sellable.
  async restock(
    productId: string,
    quantity: number,
    createdById: string,
    note: string | undefined,
    client?: any,
  ) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    const run = async (tx: any) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException('Product not found');
      const cost = product.lastCost ?? 0;

      const receipt = await tx.inventoryReceipt.create({
        data: { supplier: 'Customer return', notes: note, receivedById: createdById },
      });
      const batch = await tx.inventoryBatch.create({
        data: { productId, receiptId: receipt.id, quantityReceived: quantity, remainingQuantity: quantity, unitCost: cost },
      });
      const movement = await tx.inventoryMovement.create({
        data: { productId, batchId: batch.id, type: MovementType.RETURN, quantity, unitCost: cost, note, createdById },
      });
      await tx.product.update({ where: { id: productId }, data: { stockQuantity: { increment: quantity } } });
      return movement;
    };

    return client ? run(client) : this.prisma.$transaction(run);
  }

  async adjust(input: AdjustInput, createdById: string) {
    if (!input.quantity) throw new BadRequestException('Quantity must not be zero');

    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('Product not found');

    if (input.quantity > 0) {
      // Adding stock outside a formal goods-received flow (a stocktake
      // correction, a manually-logged return). FIFO can only ever sell from
      // a real InventoryBatch, so this opens one the same way restock() and
      // openingBalance() do — costed at the last known price since no new
      // cost was actually paid here.
      const cost = product.lastCost ?? 0;
      const movement = await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.inventoryReceipt.create({
          data: { supplier: 'Stock adjustment', notes: input.note, receivedById: createdById },
        });
        const batch = await tx.inventoryBatch.create({
          data: { productId: input.productId, receiptId: receipt.id, quantityReceived: input.quantity, remainingQuantity: input.quantity, unitCost: cost },
        });
        const created = await tx.inventoryMovement.create({
          data: { productId: input.productId, batchId: batch.id, type: input.type as MovementType, quantity: input.quantity, unitCost: cost, note: input.note, createdById },
        });
        await tx.product.update({ where: { id: input.productId }, data: { stockQuantity: { increment: input.quantity } } });
        return created;
      });

      await this.audit.log({
        actorId: createdById,
        action: 'inventory.adjusted',
        entityType: 'Product',
        entityId: input.productId,
        metadata: { type: input.type, quantity: input.quantity, note: input.note },
      });
      return movement;
    }

    // Reducing stock — draw down real batches oldest-first, exactly like a
    // sale, so batches and the product's stockQuantity never drift apart.
    // Same floor-at-zero rule as a sale: an authorized shortfall never
    // pushes recorded stock below zero, it just can't remove more than is
    // really there.
    const decrease = Math.abs(input.quantity);
    const resultingStock = product.stockQuantity - decrease;
    if (resultingStock < 0 && !input.allowNegative) {
      // Same shape as documents' INSUFFICIENT_STOCK refusal — one dialog
      // component on the frontend renders both instead of parsing text.
      throw new BadRequestException({
        statusCode: 400,
        code: 'NEGATIVE_STOCK',
        message: `This would take ${product.displayName ?? product.name} to ${resultingStock}, below zero.`,
        current: product.stockQuantity,
        change: input.quantity,
        resulting: resultingStock,
      });
    }

    const { shortfall } = await this.consumeFifo(
      input.productId,
      decrease,
      input.type as 'ADJUSTMENT' | 'CORRECTION',
      createdById,
      input.note,
      input.allowNegative,
    );

    await this.audit.log({
      actorId: createdById,
      action: 'inventory.adjusted',
      entityType: 'Product',
      entityId: input.productId,
      metadata: { type: input.type, quantity: input.quantity, note: input.note, shortfall },
    });

    return { ok: true, shortfall };
  }

  // Seeds a starting stock position for a product that already has physical
  // stock when it's first entered into the system — modeled as a receipt
  // from a synthetic "Opening Balance" supplier so FIFO has a real cost lot
  // to consume from, rather than a bare quantity with no cost basis.
  async openingBalance(productId: string, quantity: number, unitCost: number, createdById: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.inventoryReceipt.create({
        data: { supplier: 'Opening Balance', receivedById: createdById },
      });
      const batch = await tx.inventoryBatch.create({
        data: { productId, receiptId: receipt.id, quantityReceived: quantity, remainingQuantity: quantity, unitCost },
      });
      await tx.inventoryMovement.create({
        data: { productId, batchId: batch.id, type: MovementType.OPENING, quantity, unitCost, createdById },
      });
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: quantity }, lastCost: unitCost },
      });
      return batch;
    });
  }

  // Cost visibility is a permission axis separate from module access (a
  // user can have INVENTORY access — receive/adjust stock — without seeing
  // what any of it cost). Batch/movement unitCost is stripped here rather
  // than at the controller so every caller gets the same guarantee.
  private redactBatchCost<T extends { unitCost: number }>(batch: T, canViewCost: boolean) {
    if (canViewCost) return batch;
    return { ...batch, unitCost: undefined as unknown as number };
  }
  private redactMovementCost<T extends { unitCost: number | null }>(movement: T, canViewCost: boolean) {
    if (canViewCost) return movement;
    return { ...movement, unitCost: undefined as unknown as number | null };
  }

  async receipts(canViewCost: boolean) {
    const receipts = await this.prisma.inventoryReceipt.findMany({
      include: {
        receivedBy: { select: { name: true } },
        batches: { include: { product: { select: { id: true, name: true, displayName: true } } } },
      },
      orderBy: { receivedAt: 'desc' },
    });
    return receipts.map((r) => ({ ...r, batches: r.batches.map((b) => this.redactBatchCost(b, canViewCost)) }));
  }

  async receiptDetail(id: string, canViewCost: boolean) {
    const receipt = await this.prisma.inventoryReceipt.findUnique({
      where: { id },
      include: {
        receivedBy: { select: { name: true } },
        batches: { include: { product: { select: { id: true, name: true, displayName: true, unit: true } } } },
      },
    });
    if (!receipt) return receipt;
    return { ...receipt, batches: receipt.batches.map((b) => this.redactBatchCost(b, canViewCost)) };
  }

  async batchesForProduct(productId: string, canViewCost: boolean) {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { productId },
      include: { receipt: { select: { supplier: true, reference: true, receivedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return batches.map((b) => this.redactBatchCost(b, canViewCost));
  }

  async movementsForProduct(productId: string, canViewCost: boolean) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { productId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return movements.map((m) => this.redactMovementCost(m, canViewCost));
  }
}