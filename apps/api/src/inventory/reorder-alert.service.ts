import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ReorderService, type ReorderItem } from './reorder.service.js';
import { localNow, msUntilNextHour } from '../common/local-time.js';

// No fixed-interval polling. The check runs (1) shortly after stock changes, debounced so a busy
// till doesn't trigger it per sale, (2) once a day at the summary hour, which also covers "still
// short after its lead time", and (3) once after a restart.
const DEBOUNCE_MS = 2 * 60 * 1000;
const SETTLE_MS = 5 * 1000;
const BOOT_CHECK_MS = 60 * 1000;
const URL = '/inventory?tab=reorder';

function readHour(): number {
  const n = Number(process.env.REMINDER_HOUR ?? 8);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 8;
}

function summary(items: ReorderItem[]) {
  const names = items.slice(0, 3).map((i) => `${i.name}${i.suggestedQty ? ` (${i.suggestedQty} ${i.unit})` : ''}`);
  const more = items.length > 3 ? ` +${items.length - 3} more` : '';
  return `${names.join(', ')}${more}`;
}

/**
 * Watches stock against each item's reorder point. An item is announced once when it drops to its
 * reorder point, again only if it is still short after its lead time has passed, and a short morning
 * summary lists everything still waiting. Receiving stock clears it automatically (it simply stops
 * being short on the next check).
 */
@Injectable()
export class ReorderAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ReorderAlertService.name);
  private readonly timeZone = process.env.REMINDER_TIMEZONE?.trim() || 'Africa/Nairobi';
  private readonly digestHour = readHour();
  private daily: ReturnType<typeof setTimeout> | null = null;
  private boot: ReturnType<typeof setTimeout> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private rerun = false;

  constructor(
    private prisma: PrismaService,
    private reorder: ReorderService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.boot = setTimeout(() => void this.tick(), BOOT_CHECK_MS);
    this.armDaily();
    this.log.log(`Reorder alerts on: checked after stock changes and daily at ${String(this.digestHour).padStart(2, '0')}:00 ${this.timeZone}`);
  }

  onModuleDestroy() {
    for (const t of [this.daily, this.boot, this.debounce, this.settle]) if (t) clearTimeout(t);
  }

  private armDaily() {
    if (this.daily) clearTimeout(this.daily);
    this.daily = setTimeout(() => void this.tick().finally(() => this.armDaily()), msUntilNextHour(this.timeZone, this.digestHour) + 2000);
  }

  /**
   * Stock moved (sale, receipt, adjustment, return). Drops the cached plan right away so the
   * dashboard and Reorder tab are current, then checks for alerts once things have settled. The
   * delay also lets the caller's transaction commit before the check reads stock.
   */
  stockChanged() {
    this.reorder.invalidate();
    if (this.settle) clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      this.settle = null;
      this.reorder.invalidate();
    }, SETTLE_MS);
    if (this.debounce) return;
    this.debounce = setTimeout(() => {
      this.debounce = null;
      void this.tick();
    }, DEBOUNCE_MS);
  }

  async tick() {
    if (this.running) {
      this.rerun = true; // stock moved mid-check: go round once more afterwards
      return;
    }
    this.running = true;
    try {
      const plan = await this.reorder.plan();
      const needing = plan.items;
      await this.announce(needing);
      await this.morningSummary(needing);
    } catch (err) {
      this.log.error(`Reorder check failed: ${(err as Error)?.message ?? err}`);
    } finally {
      this.running = false;
    }
    if (this.rerun) {
      this.rerun = false;
      this.reorder.invalidate();
      void this.tick();
    }
  }

  private async recipients(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { active: true, OR: [{ role: Role.ADMIN }, { permissions: { has: 'INVENTORY' } }] },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async announce(needing: ReorderItem[]) {
    const open = await this.prisma.reorderAlert.findMany();
    const openKey = new Map(open.map((a) => [`${a.entityType}:${a.entityId}`, a]));
    const needKey = new Set(needing.map((i) => `${i.kind}:${i.id}`));

    // Stock came in (or demand fell): no longer short, so forget it — it can be announced afresh later.
    const cleared = open.filter((a) => !needKey.has(`${a.entityType}:${a.entityId}`));
    if (cleared.length) await this.prisma.reorderAlert.deleteMany({ where: { id: { in: cleared.map((a) => a.id) } } });

    const fresh: ReorderItem[] = [];
    const overdue: ReorderItem[] = [];
    const now = Date.now();
    for (const item of needing) {
      const existing = openKey.get(`${item.kind}:${item.id}`);
      if (!existing) {
        try {
          await this.prisma.reorderAlert.create({ data: { entityType: item.kind, entityId: item.id } });
          fresh.push(item);
        } catch (err: any) {
          if (err?.code !== 'P2002') throw err; // another run got there first
        }
      } else if (now - existing.lastNotifiedAt.getTime() > (item.leadTimeDays + 1) * 86_400_000) {
        await this.prisma.reorderAlert.update({ where: { id: existing.id }, data: { lastNotifiedAt: new Date() } });
        overdue.push(item);
      }
    }

    const ids = fresh.length || overdue.length ? await this.recipients() : [];
    if (fresh.length) {
      await this.notifications.notifyUsers(ids, {
        kind: 'reorder',
        title: fresh.length === 1 ? '1 item to reorder' : `${fresh.length} items to reorder`,
        body: summary(fresh),
        url: URL,
      });
    }
    if (overdue.length) {
      await this.notifications.notifyUsers(ids, {
        kind: 'reorder',
        title: overdue.length === 1 ? '1 item still short' : `${overdue.length} items still short`,
        body: `Not restocked yet: ${summary(overdue)}`,
        url: URL,
      });
    }
  }

  private async morningSummary(needing: ReorderItem[]) {
    if (needing.length === 0) return;
    const { day, hour } = localNow(this.timeZone);
    if (hour < this.digestHour) return;
    try {
      await this.prisma.reorderDigest.create({ data: { day } });
    } catch (err: any) {
      if (err?.code === 'P2002') return; // already sent today
      throw err;
    }
    const ids = await this.recipients();
    const out = needing.filter((i) => i.status === 'out').length;
    await this.notifications.notifyUsers(ids, {
      kind: 'reorder',
      title: `${needing.length} ${needing.length === 1 ? 'item' : 'items'} waiting to be reordered`,
      body: `${out ? `${out} out of stock — ` : ''}${summary(needing)}`,
      url: URL,
    });
  }
}
