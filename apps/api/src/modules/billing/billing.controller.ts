import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions, CurrentUser } from '../../common/decorators';
import { BillingService } from './billing.service';
import {
    UpdateSubscriptionDto,
    CreateApiKeyDto,
    CreateWebhookDto,
    UpdateWebhookDto,
    CreateSupportSessionDto,
    CloseSupportSessionDto,
    UsageQueryDto,
} from './dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    // ── Billing overview ──

    @Get('billing')
    @Permissions('billing:read')
    async getBilling(@CurrentUser() user: { id: string }) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.getBillingOverview(ctx.organizationId);
    }

    @Patch('billing/subscription')
    @Permissions('billing:subscription:write')
    async updateSubscription(
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateSubscriptionDto,
    ) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.updateSubscription(ctx.organizationId, dto, user.id);
    }

    // ── Plans catalog ──

    @Get('billing/plans')
    @Permissions('billing:read')
    async listPlans() {
        return this.billingService.listPlans();
    }

    // ── API Keys ──

    @Post('dev/api-keys')
    @Permissions('dev:api-key:write')
    async createApiKey(@CurrentUser() user: { id: string }, @Body() dto: CreateApiKeyDto) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.createApiKey(ctx.organizationId, dto, user.id);
    }

    @Get('dev/api-keys')
    @Permissions('dev:api-key:read')
    async listApiKeys(@CurrentUser() user: { id: string }) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.listApiKeys(ctx.organizationId);
    }

    @Post('dev/api-keys/:id/revoke')
    @HttpCode(200)
    @Permissions('dev:api-key:write')
    async revokeApiKey(@CurrentUser() user: { id: string }, @Param('id') id: string) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.revokeApiKey(ctx.organizationId, id, user.id);
    }

    // ── Webhooks ──

    @Post('dev/webhooks')
    @Permissions('dev:webhook:write')
    async createWebhook(@CurrentUser() user: { id: string }, @Body() dto: CreateWebhookDto) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.createWebhook(ctx.organizationId, dto, user.id);
    }

    @Get('dev/webhooks')
    @Permissions('dev:webhook:read')
    async listWebhooks(@CurrentUser() user: { id: string }) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.listWebhooks(ctx.organizationId);
    }

    @Patch('dev/webhooks/:id')
    @Permissions('dev:webhook:write')
    async updateWebhook(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: UpdateWebhookDto,
    ) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.updateWebhook(ctx.organizationId, id, dto, user.id);
    }

    // ── Usage ──

    @Get('dev/usage')
    @Permissions('dev:usage:read')
    async getUsage(@CurrentUser() user: { id: string }, @Query() dto: UsageQueryDto) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.getUsage(ctx.organizationId, dto);
    }

    // ── Support Sessions ──

    @Post('support/sessions')
    @Permissions('support:session:write')
    async createSupportSession(
        @CurrentUser() user: { id: string },
        @Body() dto: CreateSupportSessionDto,
    ) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.createSupportSession(ctx.organizationId, dto, user.id);
    }

    @Get('support/sessions')
    @Permissions('support:session:read')
    async listSupportSessions(@CurrentUser() user: { id: string }) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.listSupportSessions(ctx.organizationId);
    }

    @Patch('support/sessions/:id/close')
    @Permissions('support:session:write')
    async closeSupportSession(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
        @Body() dto: CloseSupportSessionDto,
    ) {
        const ctx = await this.billingService.resolveOrgContext(user.id);
        return this.billingService.closeSupportSession(ctx.organizationId, id, dto, user.id);
    }

    // ── Dev Admins ──

    @Get('dev/admins')
    @Permissions('billing:read')
    async listDevAdmins() {
        return this.billingService.listDevAdmins();
    }
}
