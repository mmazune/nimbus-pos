import {
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FlagAuditService } from './flag-audit.service';
import {
    StartTrainingSessionDto,
    EndTrainingSessionDto,
    ListTrainingSessionsQueryDto,
} from './dto';

const DEFAULT_DURATION_MINUTES = 60;
const MAX_CONCURRENT_PER_ACTOR = 1;

@Injectable()
export class TrainingSessionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: FlagAuditService,
    ) { }

    async list(orgId: string, q: ListTrainingSessionsQueryDto) {
        const where: any = { orgId };
        if (q.status) where.status = q.status;
        if (q.actorUserId) where.actorUserId = q.actorUserId;
        const items = await this.prisma.trainingSession.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return { items, total: items.length };
    }

    async start(actorUserId: string, orgId: string, dto: StartTrainingSessionDto) {
        const concurrent = await this.prisma.trainingSession.count({
            where: { actorUserId, status: 'ACTIVE' },
        });
        if (concurrent >= MAX_CONCURRENT_PER_ACTOR) {
            throw new ForbiddenException(
                'Actor already has an active training session. End it before starting a new one.',
            );
        }

        const minutes = dto.durationMinutes ?? DEFAULT_DURATION_MINUTES;
        const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

        const session = await this.prisma.trainingSession.create({
            data: {
                orgId,
                branchId: dto.branchId ?? null,
                actorUserId,
                label: dto.label,
                purpose: dto.purpose ?? null,
                mode: (dto.mode ?? 'SIMULATION_ONLY') as any,
                status: 'ACTIVE',
                expiresAt,
                metadata: dto.metadata ? (JSON.parse(JSON.stringify(dto.metadata)) as any) : undefined,
            },
        });

        await this.audit.log({
            orgId,
            action: 'TRAINING_SESSION_STARTED',
            trainingSessionId: session.id,
            actorUserId,
            afterState: {
                mode: session.mode,
                expiresAt: session.expiresAt.toISOString(),
                label: session.label,
            },
        });

        return session;
    }

    async end(actorUserId: string, orgId: string, id: string, dto: EndTrainingSessionDto) {
        const session = await this.prisma.trainingSession.findFirst({ where: { id, orgId } });
        if (!session) throw new NotFoundException('Training session not found');
        if (session.status !== 'ACTIVE') {
            throw new BadRequestException(
                `Cannot end session with status=${session.status}; only ACTIVE sessions may be ended.`,
            );
        }
        const updated = await this.prisma.trainingSession.update({
            where: { id: session.id },
            data: {
                status: 'COMPLETED',
                endedAt: new Date(),
                endedById: actorUserId,
            },
        });

        await this.audit.log({
            orgId,
            action: 'TRAINING_SESSION_ENDED',
            trainingSessionId: updated.id,
            actorUserId,
            beforeState: { status: 'ACTIVE' },
            afterState: { status: updated.status, endedAt: updated.endedAt?.toISOString() ?? null },
            note: dto.note ?? null,
        });

        return updated;
    }

    /**
     * Look up an ACTIVE, non-expired training session for the given actor
     * by id. If `id` is missing, returns null. If the row is found but is
     * EXPIRED (past its `expiresAt`) it is transitioned to EXPIRED and `null`
     * is returned, mirroring "session not active" semantics for callers.
     */
    async findActiveForActor(
        orgId: string,
        actorUserId: string,
        sessionId: string | null | undefined,
    ) {
        if (!sessionId) return null;
        const session = await this.prisma.trainingSession.findFirst({
            where: { id: sessionId, orgId, actorUserId, status: 'ACTIVE' },
        });
        if (!session) return null;
        if (session.expiresAt.getTime() < Date.now()) {
            await this.prisma.trainingSession.update({
                where: { id: session.id },
                data: { status: 'EXPIRED', endedAt: new Date() },
            });
            return null;
        }
        return session;
    }
}
