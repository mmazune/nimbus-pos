import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PosHandoffService } from './pos-handoff.service';
import {
    SplitBillDto,
    SplitItemsDto,
    MergeOrdersDto,
    TransferTableDto,
    TransferServerDto,
    MoveOrderItemsDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService } from '../bg3-reliability';

/**
 * BG4.B — POS Order Handoff Operations.
 *
 * Six new endpoints under /api/pos/orders/* covering split-bill,
 * split-items, merge, transfer-table, transfer-server and move-items.
 * Mounted as a separate controller alongside the existing OrdersController
 * (Nest merges multiple controllers sharing the same prefix). All routes
 * are wrapped through the BG3 reliability facade with `category: null`
 * (handoff is operational POS, not billing/accounting/inventory; M42
 * maintenance windows do not apply) and `idempotencyMode: 'optional'`.
 *
 * NOTE: The static segment `/merge` is registered before any `:id`-based
 * route, so it is matched as a literal rather than as an order id.
 */
@Controller('pos/orders')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class PosHandoffController {
    constructor(
        private readonly handoff: PosHandoffService,
        private readonly bg3: Bg3ReliabilityService,
    ) { }

    // ── C) Merge two orders — registered first so `merge` is treated as
    //    a literal path segment rather than a `:id` parameter. ──

    @Post('merge')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:order:merge')
    async merge(
        @Body() dto: MergeOrdersDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'pos.orders.merge',
                routeMethod: 'POST',
                routePath: '/api/pos/orders/merge',
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.handoff.mergeOrders(ctx, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── A) Split bill ──

    @Post(':id/split-bill')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:order:split')
    async splitBill(
        @Param('id') id: string,
        @Body() dto: SplitBillDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'pos.orders.split-bill',
                routeMethod: 'POST',
                routePath: `/api/pos/orders/${id}/split-bill`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.handoff.splitBill(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── B) Split items into a new child order ──

    @Post(':id/split-items')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:order:split')
    async splitItems(
        @Param('id') id: string,
        @Body() dto: SplitItemsDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'pos.orders.split-items',
                routeMethod: 'POST',
                routePath: `/api/pos/orders/${id}/split-items`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.handoff.splitItems(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── D) Transfer table ──

    @Post(':id/transfer-table')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:order:transfer')
    async transferTable(
        @Param('id') id: string,
        @Body() dto: TransferTableDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'pos.orders.transfer-table',
                routeMethod: 'POST',
                routePath: `/api/pos/orders/${id}/transfer-table`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.handoff.transferTable(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── E) Transfer server ──

    @Post(':id/transfer-server')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:order:transfer')
    async transferServer(
        @Param('id') id: string,
        @Body() dto: TransferServerDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'pos.orders.transfer-server',
                routeMethod: 'POST',
                routePath: `/api/pos/orders/${id}/transfer-server`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.handoff.transferServer(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── F) Move items between two existing open orders ──

    @Post(':id/move-items')
    @HttpCode(HttpStatus.OK)
    @Permissions('pos:order:move-items')
    async moveItems(
        @Param('id') id: string,
        @Body() dto: MoveOrderItemsDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
        return this.bg3.guard(
            {
                req,
                scope: 'pos.orders.move-items',
                routeMethod: 'POST',
                routePath: `/api/pos/orders/${id}/move-items`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.handoff.moveItems(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }
}
