import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { normalizeSearchTerm, parseSearchHints } from './search-normalize.js';

const INCLUDE = {
  brand: true,
  category: true,
  unit: true,
  family: true,
  aliases: { select: { id: true, term: true } },
} as const;

interface ProductInput {
  name: string;
  displayName?: string;
  spec?: string;
  brandId?: string;
  categoryId?: string;
  unitId: string;
  basePrice: number;
  stockStatus?: 'IN_STOCK' | 'SUPPLIER_ONLY' | 'OUT_OF_STOCK';
  shape?: string;
  nominalSize?: string;
  widthMm?: number;
  heightMm?: number;
  thicknessMm?: number;
  gauge?: number;
  material?: string;
  familyId?: string;
  aliases?: string[]; // full replacement set, pre-dedup — see setAliases()
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Cost/margin visibility is a permission axis separate from module access
  // (brief: a user can have PRODUCTS access without seeing acquisition
  // cost). Strip it here rather than at the controller so no future caller
  // of this service can forget to. `undefined`, not `null`, so it's simply
  // absent from the JSON rather than a visible "hidden" signal.
  private redactCost<T extends { lastCost?: number | null }>(product: T, canViewCost: boolean): T {
    if (canViewCost) return product;
    return { ...product, lastCost: undefined };
  }

  private async setAliases(productId: string, aliases: string[] | undefined) {
    if (aliases === undefined) return;
    const normalized = Array.from(new Set(aliases.map(normalizeSearchTerm).filter(Boolean)));
    await this.prisma.productAlias.deleteMany({ where: { productId } });
    if (normalized.length > 0) {
      await this.prisma.productAlias.createMany({
        data: normalized.map((term) => ({ productId, term })),
      });
    }
  }

  async findAll(params: {
    search?: string;
    brandId?: string;
    categoryId?: string;
    familyId?: string;
    canViewCost: boolean;
    status?: 'active' | 'archived' | 'all';
  }) {
    const { search, brandId, categoryId, familyId, canViewCost, status = 'active' } = params;

    const baseWhere = {
      ...(status === 'all' ? {} : { active: status === 'archived' ? false : true }),
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(familyId ? { familyId } : {}),
    };

    if (!search) {
      const all = await this.prisma.product.findMany({ where: baseWhere, include: INCLUDE, orderBy: { name: 'asc' } });
      return all.map((p) => this.redactCost(p, canViewCost));
    }

    const normalized = normalizeSearchTerm(search);
    const hints = parseSearchHints(normalized);

    const candidates = await this.prisma.product.findMany({
      where: {
        ...baseWhere,
        OR: [
          { name: { contains: normalized, mode: 'insensitive' } },
          { displayName: { contains: normalized, mode: 'insensitive' } },
          { spec: { contains: normalized, mode: 'insensitive' } },
          { aliases: { some: { term: { contains: normalized } } } },
          ...(hints.gauge !== undefined ? [{ gauge: hints.gauge }] : []),
          ...(hints.widthMm !== undefined && hints.heightMm !== undefined
            ? [{ widthMm: hints.widthMm, heightMm: hints.heightMm }]
            : []),
          ...(hints.inchSize !== undefined ? [{ nominalSize: { contains: String(hints.inchSize) } }] : []),
        ],
      },
      include: INCLUDE,
      take: 200, // catalogues here are hundreds/low-thousands of SKUs, not millions — rank in app code rather than a heavier SQL scoring query
    });

    // Ranking per brief §9: exact name/alias first, then structured
    // attribute match, then partial substring.
    function score(p: (typeof candidates)[number]): number {
      const name = p.name.toLowerCase();
      const display = (p.displayName ?? '').toLowerCase();
      if (name === normalized || display === normalized) return 0;
      if (p.aliases.some((a) => a.term === normalized)) return 1;
      if (
        (hints.gauge !== undefined && p.gauge === hints.gauge) ||
        (hints.widthMm !== undefined && p.widthMm === hints.widthMm && p.heightMm === hints.heightMm)
      ) {
        return 2;
      }
      if (name.startsWith(normalized) || display.startsWith(normalized)) return 3;
      return 4;
    }

    return candidates
      .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
      .map((p) => this.redactCost(p, canViewCost));
  }

  async findOne(id: string, canViewCost = true) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!product) throw new NotFoundException('Product not found');
    return this.redactCost(product, canViewCost);
  }

  async create(data: ProductInput, actorId: string) {
    const { aliases, ...rest } = data;
    const product = await this.prisma.product.create({ data: rest });
    await this.setAliases(product.id, aliases);
    await this.audit.log({
      actorId,
      action: 'product.created',
      entityType: 'Product',
      entityId: product.id,
      metadata: { name: product.name, basePrice: product.basePrice },
    });
    return this.findOne(product.id);
  }

  // changedById is required whenever basePrice might change, so we can log who
  // changed it. Past documents are never affected — they hold their own frozen
  // unitPrice — this is purely the audit trail for "what did we list it at, when".
  async update(id: string, changedById: string, data: Partial<ProductInput> & { active?: boolean }) {
    const existing = await this.findOne(id);
    const { aliases, ...rest } = data;
    await this.prisma.product.update({ where: { id }, data: rest });
    await this.setAliases(id, aliases);

    if (data.basePrice !== undefined && data.basePrice !== existing.basePrice) {
      await this.prisma.productPriceHistory.create({
        data: {
          productId: id,
          oldPrice: existing.basePrice,
          newPrice: data.basePrice,
          changedById,
        },
      });
      // Price changes already have their own dedicated audit surface
      // (ProductPriceHistory) — no need to double-log here.
    }
    const changedFields = Object.keys(rest);
    if (changedFields.length > 0) {
      await this.audit.log({
        actorId: changedById,
        action: 'product.updated',
        entityType: 'Product',
        entityId: id,
        metadata: { fields: changedFields },
      });
    }
    return this.findOne(id);
  }

  priceHistory(id: string) {
    return this.prisma.productPriceHistory.findMany({
      where: { productId: id },
      orderBy: { changedAt: 'desc' },
      include: { changedBy: { select: { name: true } } },
    });
  }

  families() {
    return this.prisma.productFamily.findMany({ orderBy: { name: 'asc' } });
  }

  createFamily(data: { name: string; aggregateLowStock?: boolean; lowStockThreshold?: number }) {
    return this.prisma.productFamily.create({ data });
  }

  async updateFamily(id: string, data: { name?: string; aggregateLowStock?: boolean; lowStockThreshold?: number | null }) {
    const family = await this.prisma.productFamily.findUnique({ where: { id } });
    if (!family) throw new NotFoundException('Product family not found');
    return this.prisma.productFamily.update({ where: { id }, data });
  }

  // Soft delete — keeps history on any past document_items (and price history) intact.
  async remove(id: string, actorId: string) {
    const product = await this.prisma.product.update({ where: { id }, data: { active: false } });
    await this.audit.log({
      actorId,
      action: 'product.archived',
      entityType: 'Product',
      entityId: id,
      metadata: { name: product.name },
    });
    return product;
  }

  async restore(id: string, actorId: string) {
    const product = await this.prisma.product.update({ where: { id }, data: { active: true } });
    await this.audit.log({ actorId, action: 'product.restored', entityType: 'Product', entityId: id, metadata: { name: product.name } });
    return product;
  }

  // Permanent — only once archived, and only once nothing real would be
  // lost: any document line it was ever sold on, any return, any price
  // change, or any inventory movement/batch. A product with none of those
  // was created and archived by mistake before it ever transacted, which
  // is exactly the case this exists for. Aliases have no history of their
  // own and are dropped along with it.
  async hardDelete(id: string, actorId: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.active) throw new BadRequestException('Archive this product before deleting it permanently');
    const [itemCount, returnItemCount, priceHistoryCount, batchCount, movementCount] = await Promise.all([
      this.prisma.documentItem.count({ where: { productId: id } }),
      this.prisma.returnItem.count({ where: { productId: id } }),
      this.prisma.productPriceHistory.count({ where: { productId: id } }),
      this.prisma.inventoryBatch.count({ where: { productId: id } }),
      this.prisma.inventoryMovement.count({ where: { productId: id } }),
    ]);
    if (itemCount > 0 || returnItemCount > 0 || priceHistoryCount > 0 || batchCount > 0 || movementCount > 0) {
      throw new BadRequestException('This product has sales, stock, or price history and cannot be permanently deleted');
    }
    await this.prisma.productAlias.deleteMany({ where: { productId: id } });
    await this.prisma.product.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'product.deleted_permanently', entityType: 'Product', entityId: id, metadata: { name: product.name } });
    return { deleted: true };
  }
}