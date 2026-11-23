import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ReorderService, type ReorderItem } from './reorder.service.js';

const TICK_MS = 10 * 60 * 1000;
const FIRST_TICK_MS = 60 * 1000;
const URL = '/inventory?tab=reorder';

function readHour(): number {
  const n = Number(process.env.REMINDER_HOUR ?? 8);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 8;
}

function localNow(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
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
  private timer: ReturnType<typeof setInterval> | null = null;
  private first: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private reorder: ReorderService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.first = setTimeout(() => void this.tick(), FIRST_TICK_MS);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.log.log(`Reorder alerts on: checked every ${TICK_MS / 60000} min, morning summary from ${String(this.digestHour).padStart(2, '0')}:00 ${this.timeZone}`);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
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
