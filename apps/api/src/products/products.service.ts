import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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
  constructor(private prisma: PrismaService) {}

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

  async findAll(params: { search?: string; brandId?: string; categoryId?: string; familyId?: string }) {
    const { search, brandId, categoryId, familyId } = params;

    const baseWhere = {
      active: true,
      ...(brandId ? { brandId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(familyId ? { familyId } : {}),
    };

    if (!search) {
      return this.prisma.product.findMany({ where: baseWhere, include: INCLUDE, orderBy: { name: 'asc' } });
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

    return candidates.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: INCLUDE });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(data: ProductInput) {
    const { aliases, ...rest } = data;
    const product = await this.prisma.product.create({ data: rest });
    await this.setAliases(product.id, aliases);
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

  setImage(id: string, imageUrl: string) {
    return this.prisma.product.update({ where: { id }, data: { imageUrl } });
  }

  families() {
    return this.prisma.productFamily.findMany({ orderBy: { name: 'asc' } });
  }

  // Soft delete — keeps history on any past document_items (and price history) intact.
  remove(id: string) {
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }
}