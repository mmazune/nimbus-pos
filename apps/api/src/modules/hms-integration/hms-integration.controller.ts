import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyAuthGuard, PermissionGuard } from '../../common/guards';
import { Permissions } from '../../common/decorators';
import { HmsIntegrationService } from './hms-integration.service';
import { HmsAccessLogInterceptor } from './hms-access-log.interceptor';
import {
    HmsListOrdersDto,
    HmsListPaymentsDto,
    HmsListReservationsDto,
    HmsListEventsDto,
    HmsListInventoryDto,
    HmsListMenuDto,
    HmsListShiftsDto,
    HmsListAccessLogsDto,
    HmsPaginationDto,
} from './dto';

/**
 * BG7 — HMS Integration façade.
 *
 * All routes are exclusively API-key authenticated via `ApiKeyAuthGuard`.
 * The guard populates `req.user.permissions = ['hms:read:*', ...keyScopes]`
 * so the standard `PermissionGuard` continues to enforce coarse access.
 *
 * Tenancy is bound by the API key:
 *   - key.branchId === null → org-wide read across all branches
 *   - key.branchId !== null → restricted to that single branch
 *
 * Every request is journaled to `integration_access_logs` by the
 * `HmsAccessLogInterceptor`.
 */
@Controller('hms')
@UseGuards(ApiKeyAuthGuard, PermissionGuard)
@UseInterceptors(HmsAccessLogInterceptor)
@Permissions('hms:read:*')
export class HmsIntegrationController {
    constructor(private readonly hms: HmsIntegrationService) { }

    private ctxOf(req: Request) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (req as any).apiKeyContext as {
            apiKeyId: string;
            orgId: string;
            branchId: string | null;
            ipAddress: string | null;
        };
    }

    // ── Self ─────────────────────────────────────────────────────

    @Get('whoami')
    whoAmI(@Req() req: Request) {
        return this.hms.whoAmI(this.ctxOf(req).apiKeyId);
    }

    @Get('access-logs')
    listAccessLogs(@Req() req: Request, @Query() q: HmsListAccessLogsDto) {
        const c = this.ctxOf(req);
        return this.hms.listAccessLogs(c.orgId, c.apiKeyId, c.branchId, q);
    }

    // ── Org / Branch ─────────────────────────────────────────────

    @Get('organization')
    organization(@Req() req: Request) {
        const c = this.ctxOf(req);
        return this.hms.getOrganization(c.orgId, c.branchId);
    }

    @Get('branches')
    branches(@Req() req: Request) {
        const c = this.ctxOf(req);
        return this.hms.listBranches(c.orgId, c.branchId);
    }

    // ── Sales / Orders / Payments / Refunds ──────────────────────

    @Get('orders')
    listOrders(@Req() req: Request, @Query() q: HmsListOrdersDto) {
        const c = this.ctxOf(req);
        return this.hms.listOrders(c.orgId, c.branchId, q);
    }

    @Get('orders/:id')
    getOrder(@Req() req: Request, @Param('id') id: string) {
        const c = this.ctxOf(req);
        return this.hms.getOrder(c.orgId, c.branchId, id);
    }

    @Get('payments')
    listPayments(@Req() req: Request, @Query() q: HmsListPaymentsDto) {
        const c = this.ctxOf(req);
        return this.hms.listPayments(c.orgId, c.branchId, q);
    }

    @Get('refunds')
    listRefunds(@Req() req: Request, @Query() q: HmsPaginationDto) {
        const c = this.ctxOf(req);
        return this.hms.listRefunds(c.orgId, c.branchId, q);
    }

    @Get('sales/summary')
    salesSummary(@Req() req: Request, @Query() q: HmsPaginationDto) {
        const c = this.ctxOf(req);
        return this.hms.salesSummary(c.orgId, c.branchId, q);
    }

    // ── Reservations + Events ────────────────────────────────────

    @Get('reservations')
    listReservations(@Req() req: Request, @Query() q: HmsListReservationsDto) {
        const c = this.ctxOf(req);
        return this.hms.listReservations(c.orgId, c.branchId, q);
    }

    @Get('events')
    listEvents(@Req() req: Request, @Query() q: HmsListEventsDto) {
        const c = this.ctxOf(req);
        return this.hms.listEvents(c.orgId, c.branchId, q);
    }

    @Get('event-bookings')
    listEventBookings(@Req() req: Request, @Query() q: HmsPaginationDto) {
        const c = this.ctxOf(req);
        return this.hms.listEventBookings(c.orgId, c.branchId, q);
    }

    // ── Menu / Inventory ─────────────────────────────────────────

    @Get('menu')
    listMenu(@Req() req: Request, @Query() q: HmsListMenuDto) {
        const c = this.ctxOf(req);
        return this.hms.listMenuItems(c.orgId, c.branchId, q);
    }

    @Get('inventory')
    listInventory(@Req() req: Request, @Query() q: HmsListInventoryDto) {
        const c = this.ctxOf(req);
        return this.hms.listInventory(c.orgId, c.branchId, q);
    }

    // ── Shifts (close / Z-report visibility) ─────────────────────

    @Get('shifts')
    listShifts(@Req() req: Request, @Query() q: HmsListShiftsDto) {
        const c = this.ctxOf(req);
        return this.hms.listShifts(c.orgId, c.branchId, q);
    }

    // ── Accounting ───────────────────────────────────────────────

    @Get('accounting/accounts')
    listAccounts(@Req() req: Request, @Query() q: HmsPaginationDto) {
        const c = this.ctxOf(req);
        return this.hms.listAccounts(c.orgId, c.branchId, q);
    }

    @Get('accounting/invoices')
    listInvoices(@Req() req: Request, @Query() q: HmsPaginationDto) {
        const c = this.ctxOf(req);
        return this.hms.listInvoices(c.orgId, c.branchId, q);
    }

    @Get('accounting/vendor-bills')
    listVendorBills(@Req() req: Request, @Query() q: HmsPaginationDto) {
        const c = this.ctxOf(req);
        return this.hms.listVendorBills(c.orgId, c.branchId, q);
    }
}
