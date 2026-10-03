import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DocumentStatus, Module, Role } from '../../generated/prisma/client.js';
import { SettingsService } from '../settings/settings.service.js';

function has(role: Role, permissions: string[], allowed: Module[]) {
  return role === Role.ADMIN || allowed.some((m) => permissions.includes(m));
}

/**
 * Every "day" on the dashboard is a business day, not a server day or a UTC
 * day. Set BUSINESS_TIMEZONE (an IANA name) to change it; defaults to Nairobi.
 */
const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || 'Africa/Nairobi';

/** Daily points returned for the trend chart (the web app slices 7 / 30 / 90 plus the period before). */
const CHART_DAYS = 180;

const dayParts = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function partsOf(at: Date) {
  const out: Record<string, number> = {};
  for (const part of dayParts.formatToParts(at)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return out;
}

/** YYYY-MM-DD of `at` on the business calendar. */
function dayKey(at: Date) {
  const p = partsOf(at);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/** Calendar arithmetic on a YYYY-MM-DD key (no timezone involved). */
function addDays(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function offsetMs(at: Date) {
  const p = partsOf(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a business day begins (00:00 in BUSINESS_TZ). */
function startOfDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMs(new Date(guess));
  t = guess - offsetMs(new Date(t)); // settle across a DST change
  return new Date(t);
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async summary(role: Role, permissions: string[]) {
    const canSeeSales = has(role, permissions, ['POS', 'INVOICES', 'ANALYTICS', 'REPORTS'] as Module[]);
    const canSeeStock = has(role, permissions, ['INVENTORY'] as Module[]);
    const canSeeCredit = has(role, permissions, ['CUSTOMERS'] as Module[]);
    const canSeeProducts = has(role, permissions, ['PRODUCTS', 'MARKETING', 'ANALYTICS', 'REPORTS'] as Module[]);

    const todayKey = dayKey(new Date());
    const chartStartKey = addDays(todayKey, -(CHART_DAYS - 1));

    const startOfToday = startOfDay(todayKey);
    const last7 = startOfDay(addDays(todayKey, -6));
    const last30 = startOfDay(addDays(todayKey, -29));
    const chartStart = startOfDay(chartStartKey);

    const result: Record<string, unknown> = {};

    if (canSeeSales) {
      const [today, week, month, recentSales, paidDocsForChart, unpaid, paymentGroups] = await Promise.all([
        this.prisma.document.aggregate({
          where: {
            status: DocumentStatus.PAID,
            paidAt: { gte: startOfToday },
          },
          _sum: { total: true },
          _count: true,
        }),

        this.prisma.document.aggregate({
          where: {
            status: DocumentStatus.PAID,
            paidAt: { gte: last7 },
          },
          _sum: { total: true },
          _count: true,
        }),

        this.prisma.document.aggregate({
          where: {
            status: DocumentStatus.PAID,
            paidAt: { gte: last30 },
          },
          _sum: { total: true },
          _count: true,
        }),

        this.prisma.document.findMany({
          where: {
            status: {
              in: [DocumentStatus.PAID, DocumentStatus.INVOICED],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            customer: {
              select: {
                name: true,
                businessName: true,
              },
            },
          },
        }),

        this.prisma.document.findMany({
          where: {
            status: DocumentStatus.PAID,
            paidAt: { gte: chartStart },
          },
          select: {
            total: true,
            paidAt: true,
          },
        }),

        // Open (invoiced, unpaid) documents — the real count, not a count of
        // whichever ten rows happen to be in "recent sales".
        this.prisma.document.aggregate({
          where: { status: DocumentStatus.INVOICED },
          _sum: { total: true },
          _count: true,
        }),

        // Payment split over the same 30 days as the stat cards.
        this.prisma.document.groupBy({
          by: ['paymentMethod'],
          where: {
            status: DocumentStatus.PAID,
            paidAt: { gte: last30 },
          },
          _sum: { total: true },
          _count: { _all: true },
        }),
      ]);

      const byDay = new Map<string, number>();

      for (let i = 0; i < CHART_DAYS; i++) {
        byDay.set(addDays(chartStartKey, i), 0);
      }

      for (const d of paidDocsForChart) {
        if (!d.paidAt) continue;

        const key = dayKey(d.paidAt);

        if (byDay.has(key)) {
          byDay.set(key, (byDay.get(key) || 0) + d.total);
        }
      }

      result.sales = {
        today: {
          total: today._sum.total || 0,
          count: today._count,
        },
        week: {
          total: week._sum.total || 0,
          count: week._count,
        },
        month: {
          total: month._sum.total || 0,
          count: month._count,
        },
      };

      result.unpaid = {
        count: unpaid._count,
        total: unpaid._sum.total || 0,
      };

      result.paymentMix = paymentGroups
        .filter((g) => g.paymentMethod)
        .map((g) => ({
          method: String(g.paymentMethod),
          count: g._count._all,
          total: g._sum.total || 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Oldest first, ending with today (business calendar). The web app
      // relies on that order instead of re-deriving day keys.
      result.chart = Array.from(byDay.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, total]) => ({
          date,
          total,
        }));

      result.recentSales = recentSales.map((d) => ({
        id: d.id,
        customerLabel:
          d.customer?.businessName ||
          d.customer?.name ||
          d.customerName ||
          'Walk-in',
        total: d.total,
        status: d.status,
        paymentMethod: d.paymentMethod,
        createdAt: d.createdAt,
      }));
    }

    if (canSeeStock) {
      const lowStock = await this.lowStockItems();

      result.lowStockCount = lowStock.items.length;
      result.outOfStockCount = lowStock.items.filter((i) => i.stockQuantity <= 0).length;
      result.lowStock = lowStock.items.slice(0, 10);
    }

    if (canSeeCredit) {
      const [aggregate, topDebtors] = await Promise.all([
        this.prisma.customer.aggregate({
          where: {
            isCredit: true,
            creditBalance: { gt: 0 },
          },
          _sum: { creditBalance: true },
          _count: true,
        }),

        this.prisma.customer.findMany({
          where: {
            isCredit: true,
            creditBalance: { gt: 0 },
          },
          orderBy: { creditBalance: 'desc' },
          take: 5,
        }),
      ]);

      result.outstandingCredit = {
        total: aggregate._sum.creditBalance || 0,
        customerCount: aggregate._count,
        topDebtors: topDebtors.map((c) => ({
          id: c.id,
          name: c.businessName || c.name,
          balance: c.creditBalance,
          overLimit:
            c.creditLimit != null &&
            c.creditBalance > c.creditLimit,
        })),
      };
    }

    if (canSeeProducts) {
      const items = await this.prisma.documentItem.findMany({
        where: {
          document: {
            status: {
              in: [DocumentStatus.PAID, DocumentStatus.INVOICED],
            },
            createdAt: { gte: last30 },
          },
          productId: { not: null },
        },
        select: {
          productId: true,
          qty: true,
          lineTotal: true,
          product: {
            select: {
              name: true,
              displayName: true,
            },
          },
        },
      });

      const byProduct = new Map<
        string,
        {
          name: string;
          unitsSold: number;
          revenue: number;
        }
      >();

      for (const item of items) {
        if (!item.productId || !item.product) continue;

        const key = item.productId;

        const existing =
          byProduct.get(key) || {
            name:
              item.product.displayName ??
              item.product.name,
            unitsSold: 0,
            revenue: 0,
          };

        existing.unitsSold += item.qty;
        existing.revenue += item.lineTotal;

        byProduct.set(key, existing);
      }

      result.topProducts = Array.from(byProduct.entries())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    }

    return result;
  }

  async lowStockItems() {
    const { lowStockThreshold: globalThreshold } =
      await this.settings.get();

    const products = await this.prisma.product.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        stockQuantity: true,
        unit: {
          select: {
            symbol: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
            aggregateLowStock: true,
            lowStockThreshold: true,
          },
        },
      },
    });

    type Row = {
      id: string;
      name: string;
      stockQuantity: number;
      unit: string;
      threshold: number;
      kind: 'product' | 'family';
    };

    const rows: Row[] = [];

    const familyGroups = new Map<
      string,
      {
        name: string;
        threshold: number;
        unit: string;
        stockQuantity: number;
      }
    >();

    for (const p of products) {
      if (p.family?.aggregateLowStock) {
        const threshold =
          p.family.lowStockThreshold ?? globalThreshold;

        const existing = familyGroups.get(p.family.id);

        if (existing) {
          existing.stockQuantity += p.stockQuantity;
        } else {
          familyGroups.set(p.family.id, {
            name: p.family.name,
            threshold,
            unit: p.unit.symbol,
            stockQuantity: p.stockQuantity,
          });
        }

        continue;
      }

      if (p.stockQuantity <= globalThreshold) {
        rows.push({
          id: p.id,
          name: p.displayName ?? p.name,
          stockQuantity: p.stockQuantity,
          unit: p.unit.symbol,
          threshold: globalThreshold,
          kind: 'product',
        });
      }
    }

    for (const [familyId, group] of familyGroups) {
      if (group.stockQuantity <= group.threshold) {
        rows.push({
          id: familyId,
          name: group.name,
          stockQuantity: group.stockQuantity,
          unit: group.unit,
          threshold: group.threshold,
          kind: 'family',
        });
      }
    }

    rows.sort(
      (a, b) =>
        (b.threshold - b.stockQuantity) -
        (a.threshold - a.stockQuantity),
    );

    return {
      total: rows.length,
      items: rows,
    };
  }
}