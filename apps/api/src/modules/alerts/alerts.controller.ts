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
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { AlertsService } from './alerts.service';
import { DigestService } from './digest.service';
import { OwnerLiveService } from './owner-live.service';
import {
    CreateAlertRuleDto,
    UpdateAlertRuleDto,
    CreateAlertChannelDto,
    UpdateAlertChannelDto,
    TestAlertDto,
    CreateDigestScheduleDto,
    UpdateDigestScheduleDto,
    ListDeliveriesQueryDto,
    OwnerLiveQueryDto,
} from './dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AlertsController {
    constructor(
        private readonly alerts: AlertsService,
        private readonly digests: DigestService,
        private readonly ownerLive: OwnerLiveService,
    ) { }

    // ── Alert rules ──

    @Get('alerts')
    @Permissions('alerts:read')
    async overview(
        @CurrentUser() user: { id: string },
        @Query() q: ListDeliveriesQueryDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        const [rules, channels, recentDeliveries] = await Promise.all([
            this.alerts.listRules(organizationId),
            this.alerts.listChannels(organizationId),
            this.alerts.listDeliveries(organizationId, { ...q, limit: q.limit ?? 20 }),
        ]);
        return { rules, channels, recentDeliveries };
    }

    @Get('alerts/rules')
    @Permissions('alerts:read')
    async listRules(@CurrentUser() user: { id: string }) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.listRules(organizationId);
    }

    @Post('alerts/rules')
    @Permissions('alerts:rule:write')
    async createRule(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateAlertRuleDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.createRule(user.id, organizationId, dto);
    }

    @Patch('alerts/rules/:id')
    @Permissions('alerts:rule:write')
    async updateRule(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateAlertRuleDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.updateRule(user.id, organizationId, id, dto);
    }

    // ── Alert channels ──

    @Get('alerts/channels')
    @Permissions('alerts:channel:read')
    async listChannels(@CurrentUser() user: { id: string }) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.listChannels(organizationId);
    }

    @Post('alerts/channels')
    @Permissions('alerts:channel:write')
    async createChannel(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateAlertChannelDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.createChannel(user.id, organizationId, dto);
    }

    @Patch('alerts/channels/:id')
    @Permissions('alerts:channel:write')
    async updateChannel(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateAlertChannelDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.updateChannel(user.id, organizationId, id, dto);
    }

    // ── Test alert ──

    @Post('alerts/test')
    @Permissions('alerts:test')
    @HttpCode(200)
    async testAlert(
        @CurrentUser() user: { id: string },
        @Body() dto: TestAlertDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.sendTestAlert(user.id, organizationId, dto);
    }

    // ── Deliveries ──

    @Get('alerts/deliveries')
    @Permissions('alerts:delivery:read')
    async listDeliveries(
        @CurrentUser() user: { id: string },
        @Query() q: ListDeliveriesQueryDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.listDeliveries(organizationId, q);
    }

    @Post('alerts/deliveries/:id/retry')
    @Permissions('alerts:delivery:retry')
    @HttpCode(200)
    async retryDelivery(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.alerts.retryDelivery(user.id, organizationId, id);
    }

    // ── Digests ──

    @Get('alerts/digests')
    @Permissions('alerts:digest:read')
    async listDigests(@CurrentUser() user: { id: string }) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.digests.list(organizationId);
    }

    @Post('alerts/digests')
    @Permissions('alerts:digest:write')
    async createDigest(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateDigestScheduleDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.digests.create(user.id, organizationId, dto);
    }

    @Patch('alerts/digests/:id')
    @Permissions('alerts:digest:write')
    async updateDigest(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateDigestScheduleDto,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.digests.update(user.id, organizationId, id, dto);
    }

    @Post('alerts/digests/:id/run')
    @Permissions('alerts:digest:write')
    @HttpCode(200)
    async runDigest(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
    ) {
        const { organizationId } = await this.alerts.resolveOrgContext(user.id);
        return this.digests.runDigest(user.id, organizationId, id);
    }

    // ── Owner live feed ──

    @Get('owner/live')
    @Permissions('owner:live:read')
    async ownerFeed(
        @CurrentUser() user: { id: string },
        @Query() q: OwnerLiveQueryDto,
    ) {
        const { organizationId } = await this.ownerLive.resolveOrgContext(user.id);
        return this.ownerLive.getLiveFeed(organizationId, q);
    }
}
