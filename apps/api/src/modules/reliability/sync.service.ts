import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    ReplayDispatcherService,
    ReplayOutcome,
} from './replay-dispatcher.service';
import {
    ReplayBatchDto,
    ReplayJobItemDto,
    ListSyncJobsQueryDto,
    ListConflictsQueryDto,
    ResolveConflictDto,
    SyncJobTypeT,
} from './dto';

interface OrgContext {
    organizationId: string;
}

/**
 * SyncService — orchestrates queueing, replaying, and retrying offline-safe
 * write jobs. Conflict detection delegates to the per-type replay handler; the
 * service is responsible for state transitions, attempt records, and conflict
 * persistence.
 */
@Injectable()
export class SyncService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly dispatcher: ReplayDispatcherService,
    ) { }

    async resolveOrgContext(userId: string): Promise<OrgContext> {
        const membership = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!membership) {
            throw new ForbiddenException('No active membership found');
        }
        return { organizationId: membership.organizationId };
    }

    // ──────────────────────────────────────────────────────────
    // Replay
    // ──────────────────────────────────────────────────────────

    async replayBatch(
        userId: string,
        orgId: string,
        dto: ReplayBatchDto,
    ): Promise<{ accepted: number; results: Array<{ clientMutationId: string; jobId: string; status: string; resultRef?: string | null; conflictId?: string | null; error?: string | null }> }> {
        const executeNow = dto.executeNow !== false;
        const results: Array<{
            clientMutationId: string;
            jobId: string;
            status: string;
            resultRef?: string | null;
            conflictId?: string | null;
            error?: string | null;
        }> = [];

        for (const jobDto of dto.jobs ?? []) {
            const job = await this.upsertJob(userId, orgId, jobDto);
            if (executeNow) {
                const r = await this.executeJob(userId, job.id);
                results.push({
                    clientMutationId: jobDto.clientMutationId,
                    jobId: job.id,
                    status: r.status,
                    resultRef: r.resultRef ?? null,
                    conflictId: r.conflictId ?? null,
                    error: r.error ?? null,
                });
            } else {
                results.push({
                    clientMutationId: jobDto.clientMutationId,
                    jobId: job.id,
                    status: job.status,
                    resultRef: null,
                });
            }
        }

        await this.audit.log({
            actorUserId: userId,
            action: 'SYNC_REPLAY_SUBMITTED',
            entityType: 'SyncBatch',
            entityId: null,
            metadata: { jobs: results.length, executeNow },
        });

        return { accepted: results.length, results };
    }

    /**
     * Upsert a SyncJob keyed by `(orgId, clientMutationId)`. If a row already
     * exists with the same clientMutationId, return it without modification —
     * the same offline-captured intent must never be queued twice.
     */
    private async upsertJob(
        userId: string,
        orgId: string,
        dto: ReplayJobItemDto,
    ) {
        const existing = await this.prisma.syncJob.findUnique({
            where: {
                orgId_clientMutationId: {
                    orgId,
                    clientMutationId: dto.clientMutationId,
                },
            },
        });
        if (existing) return existing;

        if (dto.branchId) {
            const branch = await this.prisma.branch.findFirst({
                where: { id: dto.branchId, organizationId: orgId },
                select: { id: true },
            });
            if (!branch) throw new BadRequestException('branchId not in this organization');
        }

        return this.prisma.syncJob.create({
            data: {
                orgId,
                branchId: dto.branchId ?? null,
                actorUserId: userId,
                type: dto.type as any,
                status: 'QUEUED',
                origin: (dto.origin ?? 'OFFLINE_CLIENT') as any,
                clientMutationId: dto.clientMutationId,
                idempotencyKey: dto.idempotencyKey ?? null,
                routeMethod: dto.routeMethod ?? null,
                routePath: dto.routePath ?? null,
                requestBody: dto.requestBody as any,
                requestHeaders: (dto.requestHeaders ?? null) as any,
                intentSummary: dto.intentSummary ?? null,
                capturedAt: new Date(dto.capturedAt),
                metadata: (dto.metadata ?? null) as any,
            },
        });
    }

    /**
     * Execute (or re-execute) a single SyncJob. Idempotent by design:
     *   - already SUCCEEDED returns DUPLICATE_SUPPRESSED outcome and is not retried
     *   - already CONFLICT returns the existing conflict id
     */
    async executeJob(
        actorUserId: string,
        jobId: string,
    ): Promise<{ status: string; resultRef?: string | null; conflictId?: string | null; error?: string | null }> {
        const job = await this.prisma.syncJob.findUnique({ where: { id: jobId } });
        if (!job) throw new NotFoundException('Sync job not found');

        if (job.status === 'SUCCEEDED') {
            return {
                status: job.status,
                resultRef: job.resultRef,
                error: null,
            };
        }
        if (job.status === 'CONFLICT') {
            const conflict = await this.prisma.syncConflict.findFirst({
                where: { jobId: job.id, status: 'OPEN' },
                orderBy: { createdAt: 'desc' },
            });
            return {
                status: job.status,
                conflictId: conflict?.id ?? null,
                error: job.lastError,
            };
        }

        // Mark in-progress + record attempt
        const attemptNo = job.attemptCount + 1;
        await this.prisma.syncJob.update({
            where: { id: job.id },
            data: {
                status: 'IN_PROGRESS',
                attemptCount: { increment: 1 } as any,
                lastAttemptAt: new Date(),
            },
        });
        const attempt = await this.prisma.syncJobAttempt.create({
            data: {
                jobId: job.id,
                attemptNo,
                disposition: 'RETRYABLE',
            },
        });

        let outcome: ReplayOutcome;
        try {
            outcome = await this.dispatcher.replay(job.type as SyncJobTypeT, {
                orgId: job.orgId,
                branchId: job.branchId,
                actorUserId,
                idempotencyKey: job.idempotencyKey,
                requestBody: (job.requestBody as Record<string, unknown>) ?? {},
                requestHeaders: (job.requestHeaders as Record<string, unknown>) ?? null,
                intentSummary: job.intentSummary,
            });
        } catch (err: any) {
            outcome = {
                ok: false,
                disposition: 'RETRYABLE',
                error: err?.message ?? String(err),
                failureReason: 'UNCAUGHT',
            };
        }

        // Map outcome → state transitions
        if (outcome.ok) {
            await this.prisma.syncJobAttempt.update({
                where: { id: attempt.id },
                data: {
                    finishedAt: new Date(),
                    disposition: 'RETRYABLE', // success doesn't really need a disposition; keep default
                },
            });
            await this.prisma.syncJob.update({
                where: { id: job.id },
                data: {
                    status: 'SUCCEEDED',
                    completedAt: new Date(),
                    resultRef: outcome.resultRef ?? null,
                    resultSummary: (outcome.resultSummary ?? null) as any,
                    lastError: null,
                    failureReason: null,
                    nextRetryAt: null,
                },
            });
            await this.audit.log({
                actorUserId,
                action: 'SYNC_JOB_SUCCEEDED',
                entityType: 'SyncJob',
                entityId: job.id,
                metadata: {
                    type: job.type,
                    attemptNo,
                    resultRef: outcome.resultRef ?? null,
                },
            });
            return { status: 'SUCCEEDED', resultRef: outcome.resultRef ?? null };
        }

        if (outcome.disposition === 'CONFLICT') {
            const conflict = await this.prisma.syncConflict.create({
                data: {
                    orgId: job.orgId,
                    jobId: job.id,
                    type: job.type,
                    status: 'OPEN',
                    clientPayload: (job.requestBody ?? {}) as any,
                    serverState: (outcome.serverState ?? {}) as any,
                    diffSummary:
                        outcome.diffSummary ?? outcome.error ?? 'Conflict detected during replay',
                    reason: outcome.failureReason ?? outcome.error ?? 'CONFLICT',
                    targetEntity: outcome.resultRef?.split(':')[0] ?? null,
                    targetEntityId: outcome.resultRef?.split(':')[1] ?? null,
                },
            });
            await this.prisma.syncJobAttempt.update({
                where: { id: attempt.id },
                data: {
                    finishedAt: new Date(),
                    disposition: 'CONFLICT',
                    error: outcome.error ?? null,
                },
            });
            await this.prisma.syncJob.update({
                where: { id: job.id },
                data: {
                    status: 'CONFLICT',
                    completedAt: new Date(),
                    lastError: outcome.error ?? 'CONFLICT',
                    failureReason: outcome.failureReason ?? 'CONFLICT',
                    nextRetryAt: null,
                },
            });
            await this.audit.log({
                actorUserId,
                action: 'SYNC_CONFLICT_CREATED',
                entityType: 'SyncConflict',
                entityId: conflict.id,
                metadata: {
                    jobId: job.id,
                    type: job.type,
                    reason: conflict.reason,
                },
            });
            return {
                status: 'CONFLICT',
                conflictId: conflict.id,
                error: outcome.error ?? null,
            };
        }

        // RETRYABLE / PERMANENT_FAILURE / DUPLICATE_SUPPRESSED
        const reachedMax = job.attemptCount + 1 >= job.maxAttempts;
        const newStatus =
            outcome.disposition === 'PERMANENT_FAILURE' || reachedMax
                ? 'FAILED'
                : 'RETRYABLE';
        const nextRetryAt =
            newStatus === 'RETRYABLE'
                ? new Date(Date.now() + Math.min(2 ** attemptNo, 30) * 60 * 1000)
                : null;

        await this.prisma.syncJobAttempt.update({
            where: { id: attempt.id },
            data: {
                finishedAt: new Date(),
                disposition: outcome.disposition,
                error: outcome.error ?? null,
            },
        });
        await this.prisma.syncJob.update({
            where: { id: job.id },
            data: {
                status: newStatus,
                lastError: outcome.error ?? null,
                failureReason: outcome.failureReason ?? null,
                nextRetryAt,
                completedAt: newStatus === 'FAILED' ? new Date() : null,
            },
        });

        return {
            status: newStatus,
            error: outcome.error ?? null,
        };
    }

    // ──────────────────────────────────────────────────────────
    // Queries
    // ──────────────────────────────────────────────────────────

    async listJobs(orgId: string, q: ListSyncJobsQueryDto) {
        const limit = Math.max(1, Math.min(q.limit ?? 50, 200));
        return this.prisma.syncJob.findMany({
            where: {
                orgId,
                ...(q.status ? { status: q.status as any } : {}),
                ...(q.type ? { type: q.type as any } : {}),
                ...(q.branchId ? { branchId: q.branchId } : {}),
                ...(q.origin ? { origin: q.origin as any } : {}),
                ...(q.since ? { createdAt: { gte: new Date(q.since) } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                _count: { select: { attempts: true, conflicts: true } },
            },
        });
    }

    async getJob(orgId: string, jobId: string) {
        const job = await this.prisma.syncJob.findFirst({
            where: { id: jobId, orgId },
            include: {
                attempts: { orderBy: { attemptNo: 'asc' } },
                conflicts: { orderBy: { createdAt: 'desc' } },
            },
        });
        if (!job) throw new NotFoundException('Sync job not found');
        return job;
    }

    async retryJob(actorUserId: string, orgId: string, jobId: string) {
        const job = await this.prisma.syncJob.findFirst({
            where: { id: jobId, orgId },
        });
        if (!job) throw new NotFoundException('Sync job not found');
        if (job.status === 'SUCCEEDED') {
            throw new ConflictException('Job already SUCCEEDED — nothing to retry');
        }
        if (job.status === 'CANCELLED') {
            throw new ConflictException('Job is CANCELLED');
        }

        // Reset to QUEUED so executeJob runs cleanly
        await this.prisma.syncJob.update({
            where: { id: job.id },
            data: { status: 'QUEUED', nextRetryAt: null },
        });
        const result = await this.executeJob(actorUserId, job.id);

        await this.audit.log({
            actorUserId,
            action: 'SYNC_JOB_RETRIED',
            entityType: 'SyncJob',
            entityId: job.id,
            metadata: {
                type: job.type,
                fromStatus: job.status,
                resultStatus: result.status,
            },
        });
        return result;
    }

    // ──────────────────────────────────────────────────────────
    // Conflicts
    // ──────────────────────────────────────────────────────────

    async listConflicts(orgId: string, q: ListConflictsQueryDto) {
        const limit = Math.max(1, Math.min(q.limit ?? 50, 200));
        return this.prisma.syncConflict.findMany({
            where: {
                orgId,
                ...(q.status ? { status: q.status as any } : {}),
                ...(q.type ? { type: q.type as any } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async resolveConflict(
        actorUserId: string,
        orgId: string,
        conflictId: string,
        dto: ResolveConflictDto,
    ) {
        const conflict = await this.prisma.syncConflict.findFirst({
            where: { id: conflictId, orgId },
        });
        if (!conflict) throw new NotFoundException('Sync conflict not found');
        if (conflict.status !== 'OPEN') {
            throw new ConflictException(
                `Conflict is already ${conflict.status} — cannot re-resolve`,
            );
        }

        const updated = await this.prisma.syncConflict.update({
            where: { id: conflict.id },
            data: {
                status: dto.resolution === 'DISCARDED' ? 'DISMISSED' : 'RESOLVED',
                resolution: dto.resolution as any,
                resolvedAt: new Date(),
                resolvedById: actorUserId,
                resolutionNote: dto.note ?? null,
            },
        });

        await this.audit.log({
            actorUserId,
            action: 'SYNC_CONFLICT_RESOLVED',
            entityType: 'SyncConflict',
            entityId: updated.id,
            metadata: {
                resolution: updated.resolution,
                jobId: updated.jobId,
                type: updated.type,
            },
        });

        return updated;
    }
}
