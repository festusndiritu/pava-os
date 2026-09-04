import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll(params: { search?: string; brandId?: string; categoryId?: string }) {
    const { search, brandId, categoryId } = params;
    return this.prisma.product.findMany({
      where: {
        active: true,
        ...(brandId ? { brandId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { spec: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { brand: true, category: true, unit: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { brand: true, category: true, unit: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  create(data: {
    name: string;
    spec?: string;
    brandId?: string;
    categoryId?: string;
    unitId: string;
    basePrice: number;
    stockStatus?: 'IN_STOCK' | 'SUPPLIER_ONLY' | 'OUT_OF_STOCK';
  }) {
    return this.prisma.product.create({ data });
  }

  // changedById is required whenever basePrice might change, so we can log who
  // changed it. Past documents are never affected — they hold their own frozen
  // unitPrice — this is purely the audit trail for "what did we list it at, when".
  async update(
    id: string,
    changedById: string,
    data: Partial<{
      name: string;
      spec: string;
      brandId: string;
      categoryId: string;
      unitId: string;
      basePrice: number;
      stockStatus: 'IN_STOCK' | 'SUPPLIER_ONLY' | 'OUT_OF_STOCK';
      active: boolean;
    }>,
  ) {
    const existing = await this.findOne(id);
    const updated = await this.prisma.product.update({ where: { id }, data });

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
    return updated;
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

  // Soft delete — keeps history on any past document_items (and price history) intact.
  remove(id: string) {
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }
}
