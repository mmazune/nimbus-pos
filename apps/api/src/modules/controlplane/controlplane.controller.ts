import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { CurrentUser, Permissions } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeatureFlagService } from './feature-flag.service';
import { MaintenanceWindowService } from './maintenance-window.service';
import { TrainingSessionService } from './training-session.service';
import { FlagAuditService } from './flag-audit.service';
import {
    CreateFeatureFlagDto,
    UpdateFeatureFlagDto,
    ListFeatureFlagsQueryDto,
    CreateMaintenanceWindowDto,
    UpdateMaintenanceWindowDto,
    ListMaintenanceWindowsQueryDto,
    StartTrainingSessionDto,
    EndTrainingSessionDto,
    ListTrainingSessionsQueryDto,
    ListFlagAuditsQueryDto,
} from './dto';

/**
 * M42 — Feature Flags + Maintenance Windows + Training Mode controller.
 *
 * Endpoints:
 *   GET    /api/flags
 *   POST   /api/flags
 *   GET    /api/flags/:key
 *   PATCH  /api/flags/:key
 *   GET    /api/flags/audit
 *
 *   GET    /api/maintenance-windows
 *   POST   /api/maintenance-windows
 *   GET    /api/maintenance-windows/:id
 *   PATCH  /api/maintenance-windows/:id
 *
 *   POST   /api/training/start
 *   POST   /api/training/:id/end
 *   GET    /api/training/sessions
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ControlPlaneController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly flags: FeatureFlagService,
        private readonly windows: MaintenanceWindowService,
        private readonly training: TrainingSessionService,
        private readonly audit: FlagAuditService,
    ) { }

    private async resolveOrgId(userId: string): Promise<string> {
        const m = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!m) throw new ForbiddenException('No active membership found');
        return m.organizationId;
    }

    // ── Feature Flags ──

    @Get('flags')
    @Permissions('flags:read')
    async listFlags(
        @CurrentUser() user: { id: string },
        @Query() q: ListFeatureFlagsQueryDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.flags.list(orgId, q);
    }

    @Post('flags')
    @Permissions('flags:write')
    @HttpCode(201)
    async createFlag(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateFeatureFlagDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.flags.create(user.id, orgId, dto);
    }

    @Get('flags/audit')
    @Permissions('flags:audit:read')
    async listFlagAudits(
        @CurrentUser() user: { id: string },
        @Query() q: ListFlagAuditsQueryDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.audit.list(orgId, q);
    }

    @Get('flags/:key')
    @Permissions('flags:read')
    async getFlag(
        @CurrentUser() user: { id: string },
        @Param('key') key: string,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.flags.getByKey(orgId, key);
    }

    @Patch('flags/:key')
    @Permissions('flags:write')
    async patchFlag(
        @CurrentUser() user: { id: string },
        @Param('key') key: string,
        @Body() dto: UpdateFeatureFlagDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.flags.patchByKey(user.id, orgId, key, dto);
    }

    // ── Maintenance Windows ──

    @Get('maintenance-windows')
    @Permissions('maintenance:read')
    async listWindows(
        @CurrentUser() user: { id: string },
        @Query() q: ListMaintenanceWindowsQueryDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.windows.list(orgId, q);
    }

    @Post('maintenance-windows')
    @Permissions('maintenance:write')
    @HttpCode(201)
    async createWindow(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateMaintenanceWindowDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.windows.create(user.id, orgId, dto);
    }

    @Get('maintenance-windows/:id')
    @Permissions('maintenance:read')
    async getWindow(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.windows.get(orgId, id);
    }

    @Patch('maintenance-windows/:id')
    @Permissions('maintenance:write')
    async patchWindow(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateMaintenanceWindowDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.windows.patch(user.id, orgId, id, dto);
    }

    // ── Training Sessions ──

    @Post('training/start')
    @Permissions('training:session:start')
    @HttpCode(201)
    async startTraining(
        @CurrentUser() user: { id: string },
        @Body() dto: StartTrainingSessionDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.training.start(user.id, orgId, dto);
    }

    @Post('training/:id/end')
    @Permissions('training:session:end')
    @HttpCode(200)
    async endTraining(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: EndTrainingSessionDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.training.end(user.id, orgId, id, dto);
    }

    @Get('training/sessions')
    @Permissions('training:session:read')
    async listTraining(
        @CurrentUser() user: { id: string },
        @Query() q: ListTrainingSessionsQueryDto,
    ) {
        const orgId = await this.resolveOrgId(user.id);
        return this.training.list(orgId, q);
    }
}
