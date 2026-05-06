import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FlagAuditService } from './flag-audit.service';
import {
    CreateFeatureFlagDto,
    UpdateFeatureFlagDto,
    ListFeatureFlagsQueryDto,
} from './dto';

@Injectable()
export class FeatureFlagService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: FlagAuditService,
    ) { }

    async list(orgId: string, q: ListFeatureFlagsQueryDto) {
        const where: any = {
            OR: [{ orgId }, { scope: 'GLOBAL' }],
        };
        if (q.status) where.status = q.status;
        if (q.scope) where.scope = q.scope;
        if (q.branchId) where.branchId = q.branchId;
        const items = await this.prisma.featureFlag.findMany({
            where,
            orderBy: [{ scope: 'asc' }, { key: 'asc' }],
            take: 500,
        });
        return { items, total: items.length };
    }

    async getByKey(orgId: string, key: string) {
        const flag = await this.prisma.featureFlag.findFirst({
            where: {
                key,
                OR: [{ orgId }, { scope: 'GLOBAL' }],
            },
            orderBy: { scope: 'asc' },
        });
        if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
        return flag;
    }

    async create(actorUserId: string, orgId: string, dto: CreateFeatureFlagDto) {
        const scope = dto.scope ?? 'ORG';
        if (scope === 'BRANCH' && !dto.branchId) {
            throw new BadRequestException('branchId is required when scope=BRANCH');
        }
        if (scope === 'GLOBAL' && dto.branchId) {
            throw new BadRequestException('branchId must not be set when scope=GLOBAL');
        }
        const targetOrgId = scope === 'GLOBAL' ? null : orgId;
        const targetBranchId = scope === 'BRANCH' ? dto.branchId! : null;

        const existing = await this.prisma.featureFlag.findFirst({
            where: {
                scope: scope as any,
                key: dto.key,
                orgId: targetOrgId,
                branchId: targetBranchId,
            },
        });
        if (existing) {
            throw new ConflictException(`Feature flag '${dto.key}' already exists at scope=${scope}`);
        }

        const flag = await this.prisma.featureFlag.create({
            data: {
                key: dto.key,
                name: dto.name,
                description: dto.description ?? null,
                scope: scope as any,
                orgId: targetOrgId,
                branchId: targetBranchId,
                status: (dto.status ?? 'DISABLED') as any,
                rolloutPercent: dto.rolloutPercent ?? 0,
                targeting: dto.targeting ? (JSON.parse(JSON.stringify(dto.targeting)) as any) : undefined,
                metadata: dto.metadata ? (JSON.parse(JSON.stringify(dto.metadata)) as any) : undefined,
                createdById: actorUserId,
                updatedById: actorUserId,
            },
        });

        await this.audit.log({
            orgId: targetOrgId,
            action: 'FLAG_CREATED',
            flagId: flag.id,
            actorUserId,
            afterState: { status: flag.status, rolloutPercent: flag.rolloutPercent },
            note: `Flag created with status=${flag.status}`,
        });

        return flag;
    }

    async patchByKey(actorUserId: string, orgId: string, key: string, dto: UpdateFeatureFlagDto) {
        const flag = await this.prisma.featureFlag.findFirst({
            where: { key, OR: [{ orgId }, { scope: 'GLOBAL' }] },
            orderBy: { scope: 'asc' },
        });
        if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
        if (flag.scope === 'GLOBAL' && flag.orgId === null) {
            // Org-scoped users cannot mutate global flags
            throw new BadRequestException('Global flags cannot be patched via org-scoped endpoint');
        }

        const before = {
            status: flag.status,
            rolloutPercent: flag.rolloutPercent,
            name: flag.name,
        };

        const updated = await this.prisma.featureFlag.update({
            where: { id: flag.id },
            data: {
                name: dto.name ?? undefined,
                description: dto.description ?? undefined,
                status: (dto.status ?? undefined) as any,
                rolloutPercent: dto.rolloutPercent ?? undefined,
                targeting:
                    dto.targeting !== undefined
                        ? (JSON.parse(JSON.stringify(dto.targeting)) as any)
                        : undefined,
                metadata:
                    dto.metadata !== undefined
                        ? (JSON.parse(JSON.stringify(dto.metadata)) as any)
                        : undefined,
                updatedById: actorUserId,
            },
        });

        // Pick the most descriptive audit action.
        let action:
            | 'FLAG_UPDATED'
            | 'FLAG_ENABLED'
            | 'FLAG_DISABLED'
            | 'FLAG_ARCHIVED' = 'FLAG_UPDATED';
        if (dto.status && dto.status !== flag.status) {
            if (dto.status === 'ENABLED') action = 'FLAG_ENABLED';
            else if (dto.status === 'DISABLED') action = 'FLAG_DISABLED';
            else if (dto.status === 'ARCHIVED') action = 'FLAG_ARCHIVED';
        }

        await this.audit.log({
            orgId: flag.orgId ?? null,
            action,
            flagId: flag.id,
            actorUserId,
            beforeState: before,
            afterState: {
                status: updated.status,
                rolloutPercent: updated.rolloutPercent,
                name: updated.name,
            },
            note: dto.note ?? null,
        });

        return updated;
    }

    /**
     * Resolve a single flag against the caller's org/branch.
     * Returns `false` if missing/disabled/archived.
     */
    async isEnabled(orgId: string, key: string, branchId?: string | null): Promise<boolean> {
        const candidates = await this.prisma.featureFlag.findMany({
            where: {
                key,
                OR: [
                    { scope: 'GLOBAL' },
                    { scope: 'ORG', orgId },
                    ...(branchId ? [{ scope: 'BRANCH' as const, orgId, branchId }] : []),
                ],
            },
        });
        if (!candidates.length) return false;
        // Most-specific scope wins: BRANCH > ORG > GLOBAL.
        const order = { BRANCH: 0, ORG: 1, GLOBAL: 2 } as Record<string, number>;
        candidates.sort((a, b) => order[a.scope] - order[b.scope]);
        const winner = candidates[0];
        return winner.status === 'ENABLED';
    }
}
