import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LeadStage, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_MS = 30 * 1000;

function readHour(): number {
  const n = Number(process.env.REMINDER_HOUR ?? 8);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 8;
}

// The wall-clock date and hour in the business's time zone.
function localNow(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Sends each person one summary a day of the leads they own that are due for a follow-up (today) or past due. */
@Injectable()
export class FollowUpReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(FollowUpReminderService.name);
  private readonly timeZone = process.env.REMINDER_TIMEZONE?.trim() || 'Africa/Nairobi';
  readonly reminderHour = readHour();
  private timer: ReturnType<typeof setInterval> | null = null;
  private first: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (!this.notifications.enabled) return;
    this.first = setTimeout(() => void this.tick(), FIRST_TICK_MS);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.log.log(`Follow-up reminders on: daily from ${String(this.reminderHour).padStart(2, '0')}:00 ${this.timeZone}`);
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const { day, hour } = localNow(this.timeZone);
      if (hour < this.reminderHour) return;
      await this.sendDigests(day);
    } catch (err) {
      this.log.error(`Follow-up reminder run failed: ${(err as Error)?.message ?? err}`);
    } finally {
      this.running = false;
    }
  }

  private async sendDigests(day: string) {
    const startOfTomorrow = new Date(`${day}T00:00:00.000Z`);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const leads = await this.prisma.lead.findMany({
      where: {
        active: true,
        stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
        followUpAt: { not: null, lt: startOfTomorrow },
      },
      select: { name: true, company: true, followUpAt: true, assignedToId: true, createdById: true },
      orderBy: { followUpAt: 'asc' },
    });
    if (leads.length === 0) return;

    const byOwner = new Map<string, typeof leads>();
    for (const lead of leads) {
      const owner = lead.assignedToId ?? lead.createdById;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), lead]);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byOwner.keys()] }, active: true, pushSubscriptions: { some: {} } },
      select: { id: true, role: true, permissions: true, pushSubscriptions: true },
    });
    if (users.length === 0) return;

    const already = new Set(
      (await this.prisma.followUpDigest.findMany({ where: { day, userId: { in: users.map((u) => u.id) } }, select: { userId: true } })).map((d) => d.userId),
    );

    for (const user of users) {
      if (already.has(user.id)) continue;
      if (user.role !== Role.ADMIN && !user.permissions.includes('LEADS')) continue;

      const mine = byOwner.get(user.id) ?? [];
      const dueToday = mine.filter((l) => l.followUpAt!.toISOString().slice(0, 10) === day);
      const overdue = mine.length - dueToday.length;

      try {
        await this.prisma.followUpDigest.create({ data: { userId: user.id, day } });
      } catch (err: any) {
        if (err?.code === 'P2002') continue;
        throw err;
      }

      const names = mine.slice(0, 3).map((l) => l.company || l.name);
      const more = mine.length > 3 ? ` +${mine.length - 3} more` : '';
      const counts = [dueToday.length ? `${dueToday.length} due today` : null, overdue ? `${overdue} overdue` : null].filter(Boolean).join(', ');

      const result = await this.notifications.sendToSubscriptions(user.pushSubscriptions, {
        title: mine.length === 1 ? '1 lead to follow up' : `${mine.length} leads to follow up`,
        body: `${counts} — ${names.join(', ')}${more}`,
        url: '/leads',
        tag: 'lead-followups',
      });

      // Nothing got through for a temporary reason: give the claim back so the next tick tries again.
      if (result.delivered === 0 && result.failed > 0) {
        await this.prisma.followUpDigest.delete({ where: { userId_day: { userId: user.id, day } } }).catch(() => undefined);
      }
    }
  }
}
