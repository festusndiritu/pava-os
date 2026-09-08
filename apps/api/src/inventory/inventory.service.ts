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
  async consumeFifo(
    productId: string,
    quantity: number,
    type: 'SALE' | 'DAMAGE' | 'LOSS',
    createdById: string,
    note?: string,
    allowNegative = false,
  ) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be positive');

    return this.prisma.$transaction(async (tx) => {
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
        // Authorized shortfall — record it with no batch/cost basis rather than fake one.
        await tx.inventoryMovement.create({
          data: { productId, type: type as MovementType, quantity: -remaining, createdById, note: note ?? 'Authorized shortfall beyond recorded stock' },
        });
      }

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: quantity } },
      });

      return { totalCost, averageCost: totalCost / (quantity - Math.max(remaining, 0) || 1), consumed, shortfall: Math.max(remaining, 0) };
    });
  }

  async adjust(input: AdjustInput, createdById: string) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const resultingStock = product.stockQuantity + input.quantity;
    if (resultingStock < 0 && !input.allowNegative) {
      throw new BadRequestException('This would take stock negative. Confirm to proceed anyway.');
    }

    const [movement] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.create({
        data: {
          productId: input.productId,
          type: input.type as MovementType,
          quantity: input.quantity,
          note: input.note,
          createdById,
        },
      }),
      this.prisma.product.update({
        where: { id: input.productId },
        data: { stockQuantity: { increment: input.quantity } },
      }),
    ]);

    await this.audit.log({
      actorId: createdById,
      action: 'inventory.adjusted',
      entityType: 'Product',
      entityId: input.productId,
      metadata: { type: input.type, quantity: input.quantity, note: input.note },
    });

    return movement;
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

  receipts() {
    return this.prisma.inventoryReceipt.findMany({
      include: {
        receivedBy: { select: { name: true } },
        batches: { include: { product: { select: { id: true, name: true, displayName: true } } } },
      },
      orderBy: { receivedAt: 'desc' },
    });
  }

  receiptDetail(id: string) {
    return this.prisma.inventoryReceipt.findUnique({
      where: { id },
      include: {
        receivedBy: { select: { name: true } },
        batches: { include: { product: { select: { id: true, name: true, displayName: true, unit: true } } } },
      },
    });
  }

  batchesForProduct(productId: string) {
    return this.prisma.inventoryBatch.findMany({
      where: { productId },
      include: { receipt: { select: { supplier: true, reference: true, receivedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  movementsForProduct(productId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { productId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}