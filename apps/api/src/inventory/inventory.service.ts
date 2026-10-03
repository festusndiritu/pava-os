import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MovementType } from '../../generated/prisma/client.js';
import { roundMoney } from '../common/money.js';
import { SettingsService } from '../settings/settings.service.js';

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

// Receipts that exist only to give a stock change a cost lot. They are real
// rows (FIFO needs a batch to hang off) but not supplier deliveries, so the
// receipts log can tell them apart from goods actually received.
const OPENING_SUPPLIER = 'Opening Balance';
const ADJUSTMENT_SUPPLIER = 'Stock adjustment';
const RETURN_SUPPLIER = 'Customer return';
const SYSTEM_SUPPLIERS = [OPENING_SUPPLIER, ADJUSTMENT_SUPPLIER, RETURN_SUPPLIER];

type AdjustType = 'ADJUSTMENT' | 'CORRECTION' | 'RETURN' | 'DAMAGE' | 'LOSS';

interface AdjustInput {
  productId: string;
  quantity: number; // signed
  type: AdjustType;
  note?: string;
  allowNegative?: boolean;
  unitCost?: number; // per-unit cost of added stock; ignored when reducing
}

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
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

      return {
        totalCost: roundMoney(totalCost),
        averageCost: roundMoney(totalCost / (consumedQuantity || 1)),
        consumed,
        shortfall: Math.max(remaining, 0),
      };
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
        data: { supplier: RETURN_SUPPLIER, notes: note, receivedById: createdById },
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
    if (input.quantity > 0 && (input.type === 'DAMAGE' || input.type === 'LOSS')) {
      throw new BadRequestException('Damage and loss can only reduce stock');
    }
    if (input.quantity < 0 && input.type === 'RETURN') {
      throw new BadRequestException('A customer return adds stock. Use a correction to take stock off.');
    }

    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('Product not found');

    if (input.quantity > 0) {
      // Adding stock outside a formal goods-received flow (a stocktake
      // correction, a manually-logged return). FIFO can only ever sell from
      // a real InventoryBatch, so this opens one the same way restock() and
      // openingBalance() do. The caller can say what the units cost; without
      // that it falls back to the last known cost, and a product that has
      // never had one gets a zero-cost lot (which valuation and margins then
      // treat as "no cost on record").
      const cost = input.unitCost || product.lastCost || 0;
      const movement = await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.inventoryReceipt.create({
          data: { supplier: ADJUSTMENT_SUPPLIER, notes: input.note, receivedById: createdById },
        });
        const batch = await tx.inventoryBatch.create({
          data: { productId: input.productId, receiptId: receipt.id, quantityReceived: input.quantity, remainingQuantity: input.quantity, unitCost: cost },
        });
        const created = await tx.inventoryMovement.create({
          data: { productId: input.productId, batchId: batch.id, type: input.type as MovementType, quantity: input.quantity, unitCost: cost, note: input.note, createdById },
        });
        await tx.product.update({
          where: { id: input.productId },
          data: {
            stockQuantity: { increment: input.quantity },
            // First real cost for a product that had none becomes its last cost.
            ...(input.unitCost && input.unitCost > 0 && !product.lastCost ? { lastCost: input.unitCost } : {}),
          },
        });
        return created;
      });

      await this.audit.log({
        actorId: createdById,
        action: 'inventory.adjusted',
        entityType: 'Product',
        entityId: input.productId,
        metadata: { type: input.type, quantity: input.quantity, note: input.note, unitCost: input.unitCost },
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
      input.type as 'ADJUSTMENT' | 'CORRECTION' | 'DAMAGE' | 'LOSS',
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
        data: { supplier: OPENING_SUPPLIER, receivedById: createdById },
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

  async receipts(
    canViewCost: boolean,
    params: { search?: string; kind?: 'delivery' | 'other'; limit?: number; offset?: number } = {},
  ) {
    const { search, kind, limit, offset = 0 } = params;
    const term = search?.trim();
    const receipts = await this.prisma.inventoryReceipt.findMany({
      where: {
        ...(kind === 'delivery' ? { supplier: { notIn: SYSTEM_SUPPLIERS } } : {}),
        ...(kind === 'other' ? { supplier: { in: SYSTEM_SUPPLIERS } } : {}),
        ...(term
          ? {
              OR: [
                { supplier: { contains: term, mode: 'insensitive' as const } },
                { reference: { contains: term, mode: 'insensitive' as const } },
                {
                  batches: {
                    some: {
                      product: {
                        OR: [
                          { name: { contains: term, mode: 'insensitive' as const } },
                          { displayName: { contains: term, mode: 'insensitive' as const } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        receivedBy: { select: { name: true } },
        batches: { include: { product: { select: { id: true, name: true, displayName: true } } } },
      },
      // id breaks ties so paging by offset never skips or repeats a row.
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      ...(limit ? { take: limit, skip: offset } : {}),
    });
    return receipts.map((r) => ({ ...r, batches: r.batches.map((b) => this.redactBatchCost(b, canViewCost)) }));
  }

  // The numbers behind the Inventory header: how healthy stock is, and what it
  // is worth. Value at cost walks the live FIFO lots; a lot costed at zero (stock
  // added by an adjustment on a product that never had a cost) falls back to the
  // product's last cost, and stock with no lot at all is valued the same way.
  // Anything still without a cost is counted separately rather than silently
  // reading as free. Uses the global low-stock threshold, same as the stock
  // filters; per-family thresholds are not applied here.
  async summary(canViewCost: boolean) {
    const { lowStockThreshold } = await this.settings.get();
    const [products, batches] = await Promise.all([
      this.prisma.product.findMany({
        where: { active: true },
        select: { id: true, stockQuantity: true, lastCost: true, basePrice: true },
      }),
      this.prisma.inventoryBatch.findMany({
        where: { remainingQuantity: { gt: 0 }, product: { active: true } },
        select: { productId: true, remainingQuantity: true, unitCost: true },
      }),
    ]);

    const lots = new Map<string, { units: number; value: number; uncosted: number }>();
    const lastCostOf = new Map(products.map((p) => [p.id, p.lastCost ?? 0]));
    for (const b of batches) {
      const cost = b.unitCost > 0 ? b.unitCost : (lastCostOf.get(b.productId) ?? 0);
      const lot = lots.get(b.productId) ?? { units: 0, value: 0, uncosted: 0 };
      lot.units += b.remainingQuantity;
      lot.value += b.remainingQuantity * cost;
      if (cost === 0) lot.uncosted += b.remainingQuantity;
      lots.set(b.productId, lot);
    }

    let inStockCount = 0;
    let lowCount = 0;
    let outCount = 0;
    let retailValue = 0;
    let costValue = 0;
    let uncostedProducts = 0;
    for (const p of products) {
      if (p.stockQuantity <= 0) outCount++;
      else if (p.stockQuantity <= lowStockThreshold) lowCount++;
      else inStockCount++;
      if (p.stockQuantity > 0) retailValue += p.stockQuantity * p.basePrice;

      const lot = lots.get(p.id) ?? { units: 0, value: 0, uncosted: 0 };
      const unbatched = Math.max(0, p.stockQuantity - lot.units);
      const lastCost = p.lastCost ?? 0;
      costValue += lot.value + unbatched * lastCost;
      if (lot.uncosted > 0 || (unbatched > 0 && lastCost === 0)) uncostedProducts++;
    }

    return {
      productCount: products.length,
      inStockCount,
      lowCount,
      outCount,
      lowStockThreshold,
      retailValue,
      costValue: canViewCost ? costValue : null,
      uncostedProducts: canViewCost ? uncostedProducts : null,
    };
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