import 'dotenv/config';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private static readonly log = new Logger('Database');

  constructor() {
    const adapter = new PrismaPg(
      {
        // Runtime traffic goes through Neon's pooled (-pooler) URL. Migrations use DIRECT_URL (see prisma.config.ts).
        connectionString: process.env.DATABASE_URL!,
        // One shop needs few connections; fewer idle sockets also means less for Neon to drop on suspend.
        max: Number(process.env.DB_POOL_MAX) || 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      },
      {
        // Neon closes idle connections when compute suspends. An error on an idle pooled connection is
        // expected then: log it quietly and let the pool open a fresh one on the next query.
        onPoolError: (err) => PrismaService.log.debug(`Idle connection dropped: ${err.message}`),
        onConnectionError: (err) => PrismaService.log.debug(`Connection error: ${err.message}`),
      },
    );

    super({ adapter });
  }

  // No $connect() on boot: the first real query connects. Connecting eagerly woke Neon on every
  // restart or deploy even when nobody was using the app.

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
