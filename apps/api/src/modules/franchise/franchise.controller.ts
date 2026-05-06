import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Req,
    HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionGuard } from '../../common/guards';
import { CurrentUser, Permissions } from '../../common/decorators';
import { FranchiseService } from './franchise.service';
import {
    FranchiseOverviewQueryDto,
    FranchiseRankingsQueryDto,
    FranchiseBudgetsQueryDto,
    CreateTransferDto,
    UpdateTransferStatusDto,
    ListTransfersQueryDto,
    CreateDigestSubscriptionDto,
    UpdateDigestSubscriptionDto,
} from './dto';

/**
 * Franchise / HQ visibility controller.
 * Operates at org level — no X-Branch-Id required.
 * Org is resolved from the user's active membership.
 */
@Controller('franchise')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FranchiseController {
    constructor(private readonly franchiseService: FranchiseService) { }

    // ── Overview ──

    @Get('overview')
    @Permissions('franchise:overview:read')
    async getOverview(
        @Query() query: FranchiseOverviewQueryDto,
        @CurrentUser() user: { id: string },
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.getOverview(ctx.organizationId, query);
    }

    // ── Rankings ──

    @Get('rankings')
    @Permissions('franchise:ranking:read')
    async getRankings(
        @Query() query: FranchiseRankingsQueryDto,
        @CurrentUser() user: { id: string },
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.getRankings(ctx.organizationId, query);
    }

    @Post('rankings/generate')
    @HttpCode(200)
    @Permissions('franchise:ranking:read')
    async generateRankings(
        @Query() query: FranchiseRankingsQueryDto,
        @CurrentUser() user: { id: string },
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        const { start, end, type } = (() => {
            const now = new Date();
            const windowStart = query.windowStart
                ? new Date(query.windowStart)
                : new Date(now.getFullYear(), now.getMonth(), 1);
            const windowEnd = query.windowEnd
                ? new Date(query.windowEnd)
                : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            return { start: windowStart, end: windowEnd, type: query.windowType || 'MONTHLY' };
        })();
        return this.franchiseService.generateRankings(ctx.organizationId, type, start, end);
    }

    // ── Budget Rollups ──

    @Get('budgets')
    @Permissions('franchise:budget:read')
    async getBudgetRollups(
        @Query() query: FranchiseBudgetsQueryDto,
        @CurrentUser() user: { id: string },
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.getBudgetRollups(ctx.organizationId, query);
    }

    // ── Transfers ──

    @Post('transfers')
    @Permissions('franchise:transfer:write')
    async createTransfer(
        @Body() dto: CreateTransferDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.createTransfer(user.id, ctx.organizationId, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    @Get('transfers')
    @Permissions('franchise:transfer:read')
    async listTransfers(@Query() query: ListTransfersQueryDto, @CurrentUser() user: { id: string }) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.listTransfers(ctx.organizationId, query);
    }

    @Get('transfers/:id')
    @Permissions('franchise:transfer:read')
    async getTransfer(@Param('id') id: string, @CurrentUser() user: { id: string }) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.getTransfer(ctx.organizationId, id);
    }

    @Patch('transfers/:id/status')
    @Permissions('franchise:transfer:approve')
    async updateTransferStatus(
        @Param('id') id: string,
        @Body() dto: UpdateTransferStatusDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.updateTransferStatus(user.id, ctx.organizationId, id, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    // ── Procurement Pressure ──

    @Get('procurement-pressure')
    @Permissions('franchise:overview:read')
    async getProcurementPressure(@CurrentUser() user: { id: string }) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.getProcurementPressure(ctx.organizationId);
    }

    // ── Digest Subscriptions ──

    @Post('digests')
    @Permissions('franchise:digest:write')
    async createDigestSubscription(
        @Body() dto: CreateDigestSubscriptionDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.createDigestSubscription(user.id, ctx.organizationId, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    @Get('digests')
    @Permissions('franchise:digest:read')
    async listDigestSubscriptions(@CurrentUser() user: { id: string }) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.listDigestSubscriptions(user.id, ctx.organizationId);
    }

    @Patch('digests/:id')
    @Permissions('franchise:digest:write')
    async updateDigestSubscription(
        @Param('id') id: string,
        @Body() dto: UpdateDigestSubscriptionDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = await this.franchiseService.resolveOrgContext(user.id);
        return this.franchiseService.updateDigestSubscription(user.id, ctx.organizationId, id, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
}
