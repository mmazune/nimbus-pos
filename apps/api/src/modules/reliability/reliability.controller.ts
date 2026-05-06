import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    BadRequestException,
    Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { SyncService } from './sync.service';
import { IdempotencyService } from './idempotency.service';
import {
    ReplayBatchDto,
    ListSyncJobsQueryDto,
    ListConflictsQueryDto,
    ResolveConflictDto,
    IdempotencyInspectDto,
} from './dto';

/**
 * M41 — Reliability Layer Controller
 *
 * Endpoints:
 *   POST   /api/sync/replay
 *   GET    /api/sync/jobs
 *   GET    /api/sync/jobs/:id
 *   POST   /api/sync/jobs/:id/retry
 *   GET    /api/sync/conflicts
 *   PATCH  /api/sync/conflicts/:id/resolve
 *   POST   /api/idempotency/inspect   (debug)
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReliabilityController {
    constructor(
        private readonly sync: SyncService,
        private readonly idempotency: IdempotencyService,
    ) { }

    @Post('sync/replay')
    @Permissions('sync:jobs:write')
    @HttpCode(200)
    async replay(
        @CurrentUser() user: { id: string },
        @Body() dto: ReplayBatchDto,
        @Req() req: Request,
    ) {
        if (!Array.isArray(dto.jobs) || dto.jobs.length === 0) {
            throw new BadRequestException('jobs[] must contain at least one item');
        }
        const { organizationId } = await this.sync.resolveOrgContext(user.id);

        // BG3: optional Idempotency-Key support — if header present, wrap
        // the replay in IdempotencyService.wrap so the same batch + key
        // returns the cached batch result on retry.
        const rawKey =
            (req.headers['idempotency-key'] as string | undefined) ??
            ((req.headers as Record<string, unknown>)['Idempotency-Key'] as
                | string
                | undefined);
        if (rawKey) {
            const key = this.idempotency.requireValidKey(rawKey);
            return this.idempotency.wrap(
                {
                    key,
                    scope: 'sync.replay',
                    routeMethod: 'POST',
                    routePath: '/api/sync/replay',
                    actorUserId: user.id,
                    orgId: organizationId,
                    fingerprintSource: dto,
                },
                async () => ({
                    statusCode: 200,
                    body: await this.sync.replayBatch(user.id, organizationId, dto),
                }),
            );
        }
        return this.sync.replayBatch(user.id, organizationId, dto);
    }

    @Get('sync/jobs')
    @Permissions('sync:jobs:read')
    async listJobs(
        @CurrentUser() user: { id: string },
        @Query() q: ListSyncJobsQueryDto,
    ) {
        const { organizationId } = await this.sync.resolveOrgContext(user.id);
        return this.sync.listJobs(organizationId, q);
    }

    @Get('sync/jobs/:id')
    @Permissions('sync:jobs:read')
    async getJob(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
    ) {
        const { organizationId } = await this.sync.resolveOrgContext(user.id);
        return this.sync.getJob(organizationId, id);
    }

    @Post('sync/jobs/:id/retry')
    @Permissions('sync:jobs:retry')
    @HttpCode(200)
    async retryJob(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
    ) {
        const { organizationId } = await this.sync.resolveOrgContext(user.id);
        return this.sync.retryJob(user.id, organizationId, id);
    }

    @Get('sync/conflicts')
    @Permissions('sync:conflicts:read')
    async listConflicts(
        @CurrentUser() user: { id: string },
        @Query() q: ListConflictsQueryDto,
    ) {
        const { organizationId } = await this.sync.resolveOrgContext(user.id);
        return this.sync.listConflicts(organizationId, q);
    }

    @Patch('sync/conflicts/:id/resolve')
    @Permissions('sync:conflicts:resolve')
    async resolveConflict(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: ResolveConflictDto,
    ) {
        const { organizationId } = await this.sync.resolveOrgContext(user.id);
        return this.sync.resolveConflict(user.id, organizationId, id, dto);
    }

    @Post('idempotency/inspect')
    @Permissions('idempotency:inspect')
    @HttpCode(200)
    async inspect(
        @CurrentUser() _user: { id: string },
        @Body() dto: IdempotencyInspectDto,
    ) {
        const row = await this.idempotency.lookup(
            dto.scope ?? 'default',
            dto.routeMethod,
            dto.routePath,
            dto.key,
        );
        if (!row) return { found: false };
        return {
            found: true,
            id: row.id,
            scope: row.scope,
            status: row.status,
            statusCode: row.statusCode,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            failureSummary: row.failureSummary,
        };
    }
}
