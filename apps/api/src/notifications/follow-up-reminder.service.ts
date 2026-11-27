import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LeadStage, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { localNow, msUntilNextHour } from '../common/local-time.js';

// No polling: the service sleeps until the next reminder hour, runs once, and re-arms. The only
// other wake-ups are one catch-up after a restart, a few spaced retries when a push fails for a
// temporary reason, and a debounced check when a lead's follow-up is set for today.
const BOOT_CATCHUP_MS = 30 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const CHECK_DEBOUNCE_MS = 60 * 1000;

function readHour(): number {
  const n = Number(process.env.REMINDER_HOUR ?? 8);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 8;
}

/** Sends each person one summary a day of the leads they own that are due for a follow-up (today) or past due. */
@Injectable()
export class FollowUpReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(FollowUpReminderService.name);
  private readonly timeZone = process.env.REMINDER_TIMEZONE?.trim() || 'Africa/Nairobi';
  readonly reminderHour = readHour();
  private daily: ReturnType<typeof setTimeout> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private check: ReturnType<typeof setTimeout> | null = null;
  private boot: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (!this.notifications.enabled) return;
    this.armDaily();
    // A restart after the reminder hour must still deliver today's summary (the per-user claim in
    // FollowUpDigest makes this safe to run alongside the daily timer or another instance).
    if (localNow(this.timeZone).hour >= this.reminderHour) {
      this.boot = setTimeout(() => void this.tick(), BOOT_CATCHUP_MS);
    }
    this.log.log(`Follow-up reminders on: once a day at ${String(this.reminderHour).padStart(2, '0')}:00 ${this.timeZone}`);
  }

  onModuleDestroy() {
    for (const t of [this.daily, this.retry, this.check, this.boot]) if (t) clearTimeout(t);
  }

  /** Sleeps until the next reminder hour. Re-computed every day, so time-zone shifts can't drift it. */
  private armDaily() {
    if (this.daily) clearTimeout(this.daily);
    this.daily = setTimeout(() => {
      this.retries = 0;
      void this.tick().finally(() => this.armDaily());
    }, msUntilNextHour(this.timeZone, this.reminderHour) + 2000);
  }

  /**
   * A lead was saved with a follow-up due today or earlier. If today's summary time has already
   * passed, send it (debounced) so same-day leads still get announced, as the old all-day poll did.
   */
  requestCheck() {
    if (!this.notifications.enabled || this.check) return;
    if (localNow(this.timeZone).hour < this.reminderHour) return; // the daily run will pick it up
    this.check = setTimeout(() => {
      this.check = null;
      void this.tick();
    }, CHECK_DEBOUNCE_MS);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    let again = false;
    try {
      const { day, hour } = localNow(this.timeZone);
      if (hour < this.reminderHour) return;
      again = await this.sendDigests(day);
    } catch (err) {
      again = true;
      this.log.error(`Follow-up reminder run failed: ${(err as Error)?.message ?? err}`);
    } finally {
      this.running = false;
    }
    // A temporary failure gets a few spaced retries, not an all-day poll.
    if (again && this.retries < MAX_RETRIES && !this.retry) {
      this.retries++;
      this.retry = setTimeout(() => {
        this.retry = null;
        void this.tick();
      }, RETRY_MS);
    }
  }

  /** Returns true when a push failed for a temporary reason and the run should be retried shortly. */
  private async sendDigests(day: string): Promise<boolean> {
    let retryNeeded = false;
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
    if (leads.length === 0) return false;

    const byOwner = new Map<string, typeof leads>();
    for (const lead of leads) {
      const owner = lead.assignedToId ?? lead.createdById;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), lead]);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byOwner.keys()] }, active: true, pushSubscriptions: { some: {} } },
      select: { id: true, role: true, permissions: true, pushSubscriptions: true },
    });
    if (users.length === 0) return false;

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
        retryNeeded = true;
      }
    }
    return retryNeeded;
  }
}
