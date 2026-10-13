import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping the notification should land, relative to the web app. */
  url?: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  delivered: number;
  /** Subscriptions the push service said are gone for good (and we deleted). */
  removed: number;
  /** Temporary failures — worth trying again later. */
  failed: number;
}

// The only hosts a browser's push endpoint can legitimately be on. The server
// POSTs to whatever endpoint a client registers, so without this check a
// logged-in user could point it at any https URL they like.
const PUSH_HOSTS = ['fcm.googleapis.com', '.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com'];

export function isKnownPushService(endpoint: string): boolean {
  try {
    const { protocol, hostname } = new URL(endpoint);
    if (protocol !== 'https:') return false;
    return PUSH_HOSTS.some((h) => (h.startsWith('.') ? hostname.endsWith(h) : hostname === h));
  } catch {
    return false;
  }
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly publicKey: string | null;
  readonly enabled: boolean;

  constructor(private prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    // VAPID needs a contact URL (mailto: or https:) the push services can reach
    // if we ever misbehave. Set VAPID_SUBJECT to a real address.
    const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@pava.example';

    this.enabled = !!(publicKey && privateKey);
    this.publicKey = this.enabled ? publicKey! : null;

    if (this.enabled) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } else {
      this.log.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — push notifications are switched off.');
    }
  }

  getConfig() {
    return { enabled: this.enabled, publicKey: this.publicKey };
  }

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    if (!this.enabled) throw new BadRequestException('Push notifications are not set up on the server');
    if (!isKnownPushService(sub.endpoint)) throw new BadRequestException('This browser’s push service is not supported');

    // Keyed on endpoint: if someone else logs in on the same device, the
    // device now belongs to them.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) },
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    // Scoped to the caller — logging out must never drop a device that has
    // since been taken over by someone else.
    const { count } = await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return { removed: count };
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    return this.sendToSubscriptions(subs, payload);
  }

  async sendToSubscriptions(subs: StoredSubscription[], payload: PushPayload): Promise<SendResult> {
    const result: SendResult = { delivered: 0, removed: 0, failed: 0 };
    if (!this.enabled || subs.length === 0) return result;

    const body = JSON.stringify(payload);
    const gone: string[] = [];
    const sentIds: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 60 * 60 * 12,
            urgency: 'normal',
          });
          result.delivered++;
          sentIds.push(s.id);
        } catch (err: any) {
          // 404/410: the browser dropped this subscription (app uninstalled,
          // permission revoked). It will never work again.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            gone.push(s.id);
            result.removed++;
          } else {
            result.failed++;
            this.log.warn(`Push failed (${err?.statusCode ?? 'no status'}): ${err?.body ?? err?.message ?? err}`);
          }
        }
      }),
    );

    if (gone.length) await this.prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    if (sentIds.length) await this.prisma.pushSubscription.updateMany({ where: { id: { in: sentIds } }, data: { lastUsedAt: new Date() } });
    return result;
  }
}
