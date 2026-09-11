import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DocumentStatus, Module, Role } from '../../generated/prisma/client.js';

const LOW_STOCK_THRESHOLD = 5; // hardcoded until a Settings module exists to make this configurable

function has(role: Role, permissions: string[], allowed: Module[]) {
  return role === Role.ADMIN || allowed.some((m) => permissions.includes(m));
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(role: Role, permissions: string[]) {
    const canSeeSales = has(role, permissions, ['POS', 'INVOICES', 'ANALYTICS', 'REPORTS'] as Module[]);
    const canSeeStock = has(role, permissions, ['INVENTORY'] as Module[]);
    const canSeeCredit = has(role, permissions, ['CUSTOMERS'] as Module[]);
    const canSeeProducts = has(role, permissions, ['PRODUCTS', 'MARKETING', 'ANALYTICS', 'REPORTS'] as Module[]);

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const last7 = new Date(now.getTime() - 7 * 86400000);
    const last30 = new Date(now.getTime() - 30 * 86400000);

    const result: Record<string, unknown> = {};

    if (canSeeSales) {
      const [today, week, month, recentSales, paidDocsForChart] = await Promise.all([
        this.prisma.document.aggregate({ where: { status: DocumentStatus.PAID, paidAt: { gte: startOfToday } }, _sum: { total: true }, _count: true }),
        this.prisma.document.aggregate({ where: { status: DocumentStatus.PAID, paidAt: { gte: last7 } }, _sum: { total: true }, _count: true }),
        this.prisma.document.aggregate({ where: { status: DocumentStatus.PAID, paidAt: { gte: last30 } }, _sum: { total: true }, _count: true }),
        this.prisma.document.findMany({
          where: { status: { in: [DocumentStatus.PAID, DocumentStatus.INVOICED] } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { customer: { select: { name: true, businessName: true } } },
        }),
        this.prisma.document.findMany({
          where: { status: DocumentStatus.PAID, paidAt: { gte: last30 } },
          select: { total: true, paidAt: true },
        }),
      ]);

      const byDay = new Map<string, number>();
      for (const d of paidDocsForChart) {
        const key = d.paidAt!.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) || 0) + d.total);
      }

      result.sales = {
        today: { total: today._sum.total || 0, count: today._count },
        week: { total: week._sum.total || 0, count: week._count },
        month: { total: month._sum.total || 0, count: month._count },
      };
      result.chart = Array.from(byDay.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, total]) => ({ date, total }));
      result.recentSales = recentSales.map((d) => ({
        id: d.id,
        customerLabel: d.customer?.businessName || d.customer?.name || d.customerName || 'Walk-in',
        total: d.total,
        status: d.status,
        paymentMethod: d.paymentMethod,
        createdAt: d.createdAt,
      }));
    }

    if (canSeeStock) {
      const lowStock = await this.prisma.product.findMany({
        where: { active: true, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stockQuantity: 'asc' },
        take: 10,
        include: { unit: { select: { symbol: true } } },
      });
      result.lowStock = lowStock.map((p) => ({ id: p.id, name: p.displayName ?? p.name, stockQuantity: p.stockQuantity, unit: p.unit.symbol }));
    }

    if (canSeeCredit) {
      const [aggregate, topDebtors] = await Promise.all([
        this.prisma.customer.aggregate({ where: { isCredit: true, creditBalance: { gt: 0 } }, _sum: { creditBalance: true }, _count: true }),
        this.prisma.customer.findMany({ where: { isCredit: true, creditBalance: { gt: 0 } }, orderBy: { creditBalance: 'desc' }, take: 5 }),
      ]);
      result.outstandingCredit = {
        total: aggregate._sum.creditBalance || 0,
        customerCount: aggregate._count,
        topDebtors: topDebtors.map((c) => ({ id: c.id, name: c.businessName || c.name, balance: c.creditBalance, overLimit: c.creditLimit != null && c.creditBalance > c.creditLimit })),
      };
    }

    if (canSeeProducts) {
      const items = await this.prisma.documentItem.findMany({
        where: { document: { status: { in: [DocumentStatus.PAID, DocumentStatus.INVOICED] }, createdAt: { gte: last30 } }, productId: { not: null } },
        select: { productId: true, qty: true, lineTotal: true, product: { select: { name: true, displayName: true } } },
      });
      const byProduct = new Map<string, { name: string; unitsSold: number; revenue: number }>();
      for (const item of items) {
        if (!item.productId || !item.product) continue;
        const key = item.productId;
        const existing = byProduct.get(key) || { name: item.product.displayName ?? item.product.name, unitsSold: 0, revenue: 0 };
        existing.unitsSold += item.qty;
        existing.revenue += item.lineTotal;
        byProduct.set(key, existing);
      }
      result.topProducts = Array.from(byProduct.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }

    return result;
  }
}