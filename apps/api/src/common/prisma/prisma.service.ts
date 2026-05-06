import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Eagerly connect so Neon wakes up at service startup, not on first request
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt < 3) {
          this.logger.warn(`DB connect attempt ${attempt} failed (Neon cold start?), retrying in 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          this.logger.error('DB connect failed after 3 attempts — server will start but queries will fail until DB is reachable');
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
