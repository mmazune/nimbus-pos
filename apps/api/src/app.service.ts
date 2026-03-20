import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let dbStatus = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'error',
      db: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
