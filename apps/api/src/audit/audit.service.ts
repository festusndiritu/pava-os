import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget audit writes: a logging failure must never break the
// request that triggered it (rule #19 says don't silently swallow failures —
// so we still log to stderr, we just don't let it bubble up as a 500).
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata as any,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for action "${entry.action}"`, err as Error);
    }
  }
}
