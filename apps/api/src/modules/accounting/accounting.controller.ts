import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AccountingService } from './accounting.service';
import {
    CreateAccountDto,
    ListAccountsQueryDto,
    CreateCostCenterDto,
    CreateFiscalPeriodDto,
    UpdatePostingSourceMapDto,
    UpdateTaxLedgerConfigDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class AccountingController {
    constructor(private readonly accountingService: AccountingService) { }

    // ── Accounts ──

    @Get('accounts')
    @Permissions('pos:accounting:accounts:read')
    async listAccounts(@Query() query: ListAccountsQueryDto, @Req() req: Request) {
        const ctx = (req as any).branchContext;
        return this.accountingService.listAccounts(ctx, query);
    }

    @Post('accounts')
    @Permissions('pos:accounting:accounts:create')
    async createAccount(
        @Body() dto: CreateAccountDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.accountingService.createAccount(user.id, ctx, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    // ── Cost Centers ──

    @Get('cost-centers')
    @Permissions('pos:accounting:cost-centers:read')
    async listCostCenters(@Req() req: Request) {
        const ctx = (req as any).branchContext;
        return this.accountingService.listCostCenters(ctx);
    }

    @Post('cost-centers')
    @Permissions('pos:accounting:cost-centers:create')
    async createCostCenter(
        @Body() dto: CreateCostCenterDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.accountingService.createCostCenter(user.id, ctx, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    // ── Fiscal Periods ──

    @Get('periods')
    @Permissions('pos:accounting:periods:read')
    async listFiscalPeriods(@Req() req: Request) {
        const ctx = (req as any).branchContext;
        return this.accountingService.listFiscalPeriods(ctx.organizationId);
    }

    @Post('periods')
    @Permissions('pos:accounting:periods:create')
    async createFiscalPeriod(
        @Body() dto: CreateFiscalPeriodDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.accountingService.createFiscalPeriod(user.id, ctx.organizationId, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    @Patch('periods/:id/open')
    @Permissions('pos:accounting:periods:open')
    async openFiscalPeriod(
        @Param('id') id: string,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.accountingService.openFiscalPeriod(user.id, ctx.organizationId, id, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    // ── Posting Source Maps ──

    @Get('posting-source-maps')
    @Permissions('pos:accounting:posting-source-maps:read')
    async listPostingSourceMaps(@Req() req: Request) {
        const ctx = (req as any).branchContext;
        return this.accountingService.listPostingSourceMaps(ctx.organizationId);
    }

    @Patch('posting-source-maps/:id')
    @Permissions('pos:accounting:posting-source-maps:update')
    async updatePostingSourceMap(
        @Param('id') id: string,
        @Body() dto: UpdatePostingSourceMapDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.accountingService.updatePostingSourceMap(user.id, ctx.organizationId, id, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    // ── Tax Ledger Config ──

    @Get('tax-config')
    @Permissions('pos:accounting:tax-config:read')
    async getTaxLedgerConfig(@Req() req: Request) {
        const ctx = (req as any).branchContext;
        return this.accountingService.getTaxLedgerConfig(ctx.organizationId);
    }

    @Patch('tax-config')
    @Permissions('pos:accounting:tax-config:update')
    async updateTaxLedgerConfig(
        @Body() dto: UpdateTaxLedgerConfigDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as any).branchContext;
        return this.accountingService.updateTaxLedgerConfig(user.id, ctx.organizationId, dto, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
}
