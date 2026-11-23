import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { forecast, splitByWeight, zForServiceLevel, type ReorderBasis, type ReorderStatus } from './reorder.calc.js';

const WINDOW_DAYS = 90;
const MEMO_MS = 30_000;

export interface ReorderBrandRow {
  productId: string;
  name: string;
  brand: string | null;
  onHand: number;
  soldInWindow: number;
  suggestedQty: number;
}

export interface ReorderItem {
  kind: 'product' | 'family';
  id: string;
  name: string;
  unit: string;
  onHand: number;
  dailyRate: number;
  daysLeft: number | null;
  reorderPoint: number;
  orderUpTo: number;
  suggestedQty: number;
  leadTimeDays: number;
  /** True when this item's lead time is its own rather than the shop's usual. */
  leadTimeOverridden: boolean;
  status: ReorderStatus;
  basis: ReorderBasis;
  /** For a pooled family: what to order of each brand. Empty for a single product. */
  brands: ReorderBrandRow[];
}

export interface ReorderPlan {
  generatedAt: string;
  settings: { leadTimeDays: number; coverDays: number; serviceLevel: number };
  items: ReorderItem[];
}

@Injectable()
export class ReorderService {
  private readonly timeZone = process.env.REMINDER_TIMEZONE?.trim() || 'Africa/Nairobi';
  private readonly dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: this.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  private memo: { at: number; plan: ReorderPlan } | null = null;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  private dayKey(d: Date) {
    return this.dayFormat.format(d);
  }

  /** The last `count` complete days (yesterday back), oldest first, as local date keys. */
  private recentDays(count: number): string[] {
    const keys: string[] = [];
    const now = Date.now();
    for (let i = count; i >= 1; i--) keys.push(this.dayKey(new Date(now - i * 86_400_000)));
    return keys;
  }

  /** Everything the shop sells, with whether and how much to reorder. Only items that need it unless `all`. */
  async plan(opts: { all?: boolean } = {}): Promise<ReorderPlan> {
    const plan = await this.compute();
    return opts.all ? plan : { ...plan, items: plan.items.filter((i) => i.status !== 'ok') };
  }

  private async compute(): Promise<ReorderPlan> {
    if (this.memo && Date.now() - this.memo.at < MEMO_MS) return this.memo.plan;

    const settings = await this.settings.get();
    const z = zForServiceLevel(settings.serviceLevel);
    const days = this.recentDays(WINDOW_DAYS);
    const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const todayKey = this.dayKey(new Date());

    const [products, movements] = await Promise.all([
      this.prisma.product.findMany({
        where: { active: true, stockStatus: { not: 'SUPPLIER_ONLY' } },
        select: {
          id: true,
          name: true,
          displayName: true,
          stockQuantity: true,
          leadTimeDays: true,
          createdAt: true,
          unit: { select: { symbol: true } },
          brand: { select: { name: true } },
          family: { select: { id: true, name: true, aggregateLowStock: true, leadTimeDays: true } },
        },
      }),
      // Every movement, not just sales: replaying them backwards from today's stock tells us what
      // was on the shelf each morning, so days the item was out of stock don't read as "no demand".
      this.prisma.inventoryMovement.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { productId: true, type: true, quantity: true, createdAt: true },
      }),
    ]);

    type Day = { net: number; demand: number };
    const perProduct = new Map<string, Map<string, Day>>();
    for (const m of movements) {
      const key = this.dayKey(m.createdAt);
      const byDay = perProduct.get(m.productId) ?? new Map<string, Day>();
      const day = byDay.get(key) ?? { net: 0, demand: 0 };
      day.net += m.quantity;
      // Sales leave the shop (negative); a customer return puts units back and cancels demand.
      if (m.type === 'SALE') day.demand += -m.quantity;
      else if (m.type === 'RETURN') day.demand -= m.quantity;
      byDay.set(key, day);
      perProduct.set(m.productId, byDay);
    }

    // Group into the things we plan for: a pooled family, or a single product.
    type Group = { kind: 'product' | 'family'; id: string; name: string; unit: string; members: typeof products; familyLead: number | null };
    const groups = new Map<string, Group>();
    for (const p of products) {
      const pooled = p.family?.aggregateLowStock ? p.family : null;
      const key = pooled ? `family:${pooled.id}` : `product:${p.id}`;
      const g = groups.get(key);
      if (g) g.members.push(p);
      else
        groups.set(key, {
          kind: pooled ? 'family' : 'product',
          id: pooled ? pooled.id : p.id,
          name: pooled ? pooled.name : (p.displayName ?? p.name),
          unit: p.unit.symbol,
          members: [p],
          familyLead: pooled?.leadTimeDays ?? null,
        });
    }

    const items: ReorderItem[] = [];
    for (const g of groups.values()) {
      const onHand = g.members.reduce((a, p) => a + p.stockQuantity, 0);

      // Replay back from today's stock to find each morning's stock, pooled across the members.
      const eod = new Map<string, number>();
      let running = onHand;
      const demand = new Map<string, number>();
      const net = new Map<string, number>();
      for (const p of g.members) {
        for (const [key, d] of perProduct.get(p.id) ?? []) {
          net.set(key, (net.get(key) ?? 0) + d.net);
          demand.set(key, (demand.get(key) ?? 0) + d.demand);
        }
      }
      const startOfDay = new Map<string, number>();
      // Today's partial day is already in `onHand`; undo it first so yesterday's close is right.
      running -= net.get(todayKey) ?? 0;
      for (let i = days.length - 1; i >= 0; i--) {
        eod.set(days[i], running);
        running -= net.get(days[i]) ?? 0;
        startOfDay.set(days[i], running);
      }

      // Days an item existed for, so a recent product isn't diluted by weeks before it was stocked.
      const firstDay = this.dayKey(new Date(Math.min(...g.members.map((p) => p.createdAt.getTime()))));
      const counted: number[] = [];
      for (const key of days) {
        if (key < firstDay) continue;
        const sold = Math.max(0, demand.get(key) ?? 0);
        // Out of stock all day and nothing sold: demand is unknown, not zero.
        if ((startOfDay.get(key) ?? 0) <= 0 && sold === 0) continue;
        counted.push(sold);
      }

      const overrides = g.members.map((p) => p.leadTimeDays).filter((n): n is number => n != null);
      const ownLead = g.familyLead ?? (overrides.length ? Math.max(...overrides) : null);
      const leadTimeDays = ownLead ?? settings.leadTimeDays;

      const ageDays = (Date.now() - Math.min(...g.members.map((p) => p.createdAt.getTime()))) / 86_400_000;
      const f = forecast({
        daily: counted,
        onHand,
        leadDays: leadTimeDays,
        coverDays: settings.coverDays,
        z,
        fallbackPoint: settings.lowStockThreshold,
        isNew: ageDays < WINDOW_DAYS,
      });

      let brands: ReorderBrandRow[] = [];
      if (g.kind === 'family') {
        const sold = g.members.map((p) => {
          let units = 0;
          for (const d of perProduct.get(p.id)?.values() ?? []) units += Math.max(0, d.demand);
          return units;
        });
        // Split by what actually sold, so a brand that never moves isn't restocked; if nothing sold
        // at all, fall back to an even split.
        const weights = sold.some((u) => u > 0) ? sold : g.members.map(() => 1);
        const split = splitByWeight(f.suggestedQty, weights);
        brands = g.members
          .map((p, i) => ({ productId: p.id, name: p.displayName ?? p.name, brand: p.brand?.name ?? null, onHand: p.stockQuantity, soldInWindow: sold[i], suggestedQty: split[i] }))
          .sort((a, b) => b.suggestedQty - a.suggestedQty || b.soldInWindow - a.soldInWindow);
      }

      items.push({
        kind: g.kind,
        id: g.id,
        name: g.name,
        unit: g.unit,
        onHand,
        dailyRate: Math.round(f.dailyRate * 100) / 100,
        daysLeft: f.daysLeft == null ? null : Math.round(f.daysLeft * 10) / 10,
        reorderPoint: f.reorderPoint,
        orderUpTo: f.orderUpTo,
        suggestedQty: f.suggestedQty,
        leadTimeDays,
        leadTimeOverridden: ownLead != null,
        status: f.status,
        basis: f.basis,
        brands,
      });
    }

    // Worst first: out of stock, then least time left.
    const rank = (i: ReorderItem) => (i.status === 'out' ? 0 : i.status === 'reorder' ? 1 : 2);
    items.sort((a, b) => rank(a) - rank(b) || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.name.localeCompare(b.name));

    const plan: ReorderPlan = {
      generatedAt: new Date().toISOString(),
      settings: { leadTimeDays: settings.leadTimeDays, coverDays: settings.coverDays, serviceLevel: settings.serviceLevel },
      items,
    };
    this.memo = { at: Date.now(), plan };
    return plan;
  }
}
