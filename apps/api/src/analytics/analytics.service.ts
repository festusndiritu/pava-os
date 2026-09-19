import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DocumentStatus, MovementType } from '../../generated/prisma/client.js';

export interface Range {
  from: Date;
  to: Date;
}

/**
 * Every revenue figure here counts a document once it is settled — status
 * PAID, or the INVOICED sales that are PAVA's same-day credit (goods out,
 * paid before close) — filtered by paidAt for PAID and by createdAt for
 * still-open INVOICED ones, since an unpaid invoice has no paidAt yet.
 * CANCELLED and DRAFT never count; a QUOTE never counts until it becomes one
 * of those.
 *
 * Cost of goods sold is not an estimate: every sale consumes stock through
 * FIFO batches (see InventoryService.consumeFifo), and each unit consumed
 * records its real batch cost as an InventoryMovement of type SALE at the
 * moment it left the shelf. Summing those movements over a period gives the
 * actual cost of what was sold in it — the one number here anyone could
 * dispute is fair game to trust. The one gap: a return restocks the item
 * without reconstructing which lot it re-joins (see restock()), so its
 * original sale's cost stays booked — margin looks very slightly lean after
 * heavy returns, never inflated.
 */
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private settledWhere(range: Range) {
    return {
      OR: [
        { status: DocumentStatus.PAID, paidAt: { gte: range.from, lt: range.to } },
        { status: DocumentStatus.INVOICED, createdAt: { gte: range.from, lt: range.to } },
      ],
    };
  }

  private async cogsFor(range: Range) {
    // SALE movements store negative quantity; unit cost isn't summable
    // directly without weighting per row, so pull the rows and weight in JS
    // — the row count per period is small enough that this is cheap.
    const rows = await this.prisma.inventoryMovement.findMany({
      where: { type: MovementType.SALE, createdAt: { gte: range.from, lt: range.to } },
      select: { quantity: true, unitCost: true },
    });
    return rows.reduce((sum, r) => sum + Math.abs(r.quantity) * (r.unitCost ?? 0), 0);
  }

  async overview(range: Range, compare: boolean) {
    const where = this.settledWhere(range);
    const [agg, cogs, returns] = await Promise.all([
      this.prisma.document.aggregate({ where, _sum: { total: true }, _count: true }),
      this.cogsFor(range),
      this.prisma.return.aggregate({ where: { createdAt: { gte: range.from, lt: range.to } }, _sum: { total: true }, _count: true }),
    ]);

    const revenue = agg._sum.total || 0;
    const ordersCount = agg._count;
    const grossProfit = revenue - cogs;

    const docsForChart = await this.prisma.document.findMany({
      where,
      select: { total: true, paidAt: true, createdAt: true, status: true },
    });
    const byDay = new Map<string, number>();
    for (const d of docsForChart) {
      const key = (d.status === DocumentStatus.PAID ? d.paidAt! : d.createdAt).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + d.total);
    }
    const chart = Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, total]) => ({ date, total }));

    const result: Record<string, unknown> = {
      revenue,
      ordersCount,
      avgOrderValue: ordersCount > 0 ? revenue / ordersCount : 0,
      cogs,
      grossProfit,
      marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : null,
      returnsTotal: returns._sum.total || 0,
      returnsCount: returns._count,
      chart,
    };

    if (compare) {
      const spanMs = range.to.getTime() - range.from.getTime();
      const prevRange: Range = { from: new Date(range.from.getTime() - spanMs), to: range.from };
      const [prevAgg, prevCogs] = await Promise.all([
        this.prisma.document.aggregate({ where: this.settledWhere(prevRange), _sum: { total: true }, _count: true }),
        this.cogsFor(prevRange),
      ]);
      const prevRevenue = prevAgg._sum.total || 0;
      const prevOrders = prevAgg._count;
      result.previous = {
        revenue: prevRevenue,
        ordersCount: prevOrders,
        avgOrderValue: prevOrders > 0 ? prevRevenue / prevOrders : 0,
        grossProfit: prevRevenue - prevCogs,
      };
    }

    return result;
  }

  async salesByCategory(range: Range) {
    const items = await this.prisma.documentItem.findMany({
      where: { document: this.settledWhere(range) as any, productId: { not: null } },
      select: { qty: true, lineTotal: true, product: { select: { category: { select: { id: true, name: true } } } } },
    });
    const byCategory = new Map<string, { name: string; revenue: number; unitsSold: number }>();
    for (const item of items) {
      const key = item.product?.category?.id ?? 'uncategorised';
      const name = item.product?.category?.name ?? 'Uncategorised';
      const existing = byCategory.get(key) || { name, revenue: 0, unitsSold: 0 };
      existing.revenue += item.lineTotal;
      existing.unitsSold += item.qty;
      byCategory.set(key, existing);
    }
    return Array.from(byCategory.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async paymentMix(range: Range) {
    const rows = await this.prisma.document.groupBy({
      by: ['paymentMethod'],
      where: { ...this.settledWhere(range), paymentMethod: { not: null } },
      _sum: { total: true },
      _count: true,
    });
    return rows
      .map((r) => ({ method: r.paymentMethod, total: r._sum.total || 0, count: r._count }))
      .sort((a, b) => b.total - a.total);
  }

  async topProducts(range: Range, limit: number) {
    const items = await this.prisma.documentItem.findMany({
      where: { document: this.settledWhere(range) as any, productId: { not: null } },
      select: { qty: true, lineTotal: true, productId: true, product: { select: { name: true, displayName: true } } },
    });
    const byProduct = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    for (const item of items) {
      if (!item.productId || !item.product) continue;
      const existing = byProduct.get(item.productId) || { name: item.product.displayName ?? item.product.name, unitsSold: 0, revenue: 0 };
      existing.unitsSold += item.qty;
      existing.revenue += item.lineTotal;
      byProduct.set(item.productId, existing);
    }
    return Array.from(byProduct.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async topCustomers(range: Range, limit: number) {
    const docs = await this.prisma.document.findMany({
      where: { ...this.settledWhere(range), customerId: { not: null } },
      select: { total: true, customerId: true, customer: { select: { name: true, businessName: true } } },
    });
    const byCustomer = new Map<string, { name: string; revenue: number; orderCount: number }>();
    for (const d of docs) {
      if (!d.customerId) continue;
      const existing = byCustomer.get(d.customerId) || { name: d.customer?.businessName || d.customer?.name || 'Customer', revenue: 0, orderCount: 0 };
      existing.revenue += d.total;
      existing.orderCount += 1;
      byCustomer.set(d.customerId, existing);
    }
    return Array.from(byCustomer.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async staffPerformance(range: Range) {
    const docs = await this.prisma.document.findMany({
      where: this.settledWhere(range),
      select: { total: true, createdById: true, createdBy: { select: { name: true } } },
    });
    const byStaff = new Map<string, { name: string; revenue: number; orderCount: number }>();
    for (const d of docs) {
      const existing = byStaff.get(d.createdById) || { name: d.createdBy.name, revenue: 0, orderCount: 0 };
      existing.revenue += d.total;
      existing.orderCount += 1;
      byStaff.set(d.createdById, existing);
    }
    return Array.from(byStaff.entries())
      .map(([id, v]) => ({ id, ...v, avgOrderValue: v.orderCount > 0 ? v.revenue / v.orderCount : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // A snapshot, not a period figure — what the yard is worth right now,
  // valued at each product's last received cost (the same figure the
  // catalogue itself shows, so it never disagrees with what a person sees
  // on the product page).
  async inventorySnapshot() {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: { stockQuantity: true, lastCost: true, category: { select: { id: true, name: true } } },
    });
    const byCategory = new Map<string, { name: string; qty: number; value: number }>();
    let totalValue = 0;
    let uncostedUnits = 0;
    for (const p of products) {
      const cost = p.lastCost ?? 0;
      const value = p.stockQuantity * cost;
      totalValue += value;
      if (p.lastCost == null && p.stockQuantity > 0) uncostedUnits += p.stockQuantity;
      const key = p.category?.id ?? 'uncategorised';
      const name = p.category?.name ?? 'Uncategorised';
      const existing = byCategory.get(key) || { name, qty: 0, value: 0 };
      existing.qty += p.stockQuantity;
      existing.value += value;
      byCategory.set(key, existing);
    }
    return {
      totalValue,
      uncostedUnits,
      categories: Array.from(byCategory.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.value - a.value),
    };
  }
}