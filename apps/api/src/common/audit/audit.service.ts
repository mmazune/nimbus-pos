import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }
}
