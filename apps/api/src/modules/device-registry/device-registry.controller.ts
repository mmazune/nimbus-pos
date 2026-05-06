import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { DeviceRegistryService } from './device-registry.service';
import {
    ActivateDeviceDto,
    UpdateDeviceStatusDto,
    ListDevicesDto,
    DeviceHistoryQueryDto,
    RegisterKdsDeviceDto,
    UpsertPrinterRouteDto,
    ListPrinterRoutesDto,
    PairTerminalDto,
    UnpairTerminalDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { Bg3ReliabilityService } from '../bg3-reliability';

/**
 * BG5 — Device / Printer / Terminal Registry controller.
 *
 * All routes are branch-scoped via BranchContextGuard. Mutating routes wrap
 * through the BG3 reliability facade with `category: null` (registry writes
 * are configuration, not billing/accounting/inventory; M42 maintenance windows
 * do not apply) and `idempotencyMode: 'optional'`. Static `/kds/register`,
 * `/printers/routes`, and `/terminals/...` segments are registered before the
 * generic `/:id` routes so Nest treats them as literal path segments.
 */
@Controller('devices')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class DeviceRegistryController {
    constructor(
        private readonly devices: DeviceRegistryService,
        private readonly bg3: Bg3ReliabilityService,
    ) { }

    // ── Activation ────────────────────────────────────────────────

    @Post('activate')
    @HttpCode(HttpStatus.OK)
    @Permissions('devices:write')
    async activate(
        @Body() dto: ActivateDeviceDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.bg3.guard(
            {
                req,
                scope: 'devices.activate',
                routeMethod: 'POST',
                routePath: '/api/devices/activate',
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.devices.activateDevice(ctx, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── KDS registration sugar ────────────────────────────────────

    @Post('kds/register')
    @HttpCode(HttpStatus.OK)
    @Permissions('devices:write')
    async registerKds(
        @Body() dto: RegisterKdsDeviceDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.bg3.guard(
            {
                req,
                scope: 'devices.kds.register',
                routeMethod: 'POST',
                routePath: '/api/devices/kds/register',
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.devices.registerKdsDevice(ctx, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── Printer routes ────────────────────────────────────────────

    @Post('printers/routes')
    @HttpCode(HttpStatus.OK)
    @Permissions('devices:routes:write')
    async upsertPrinterRoute(
        @Body() dto: UpsertPrinterRouteDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.bg3.guard(
            {
                req,
                scope: 'devices.printers.routes.upsert',
                routeMethod: 'POST',
                routePath: '/api/devices/printers/routes',
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.devices.upsertPrinterRoute(ctx, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    @Get('printers/routes')
    @Permissions('devices:read')
    async listPrinterRoutes(@Query() query: ListPrinterRoutesDto, @Req() req: Request) {
        const ctx = this.ctxOf(req);
        return this.devices.listPrinterRoutes(ctx, query);
    }

    // ── Terminal pairing (STUB) ───────────────────────────────────

    @Post('terminals/pair')
    @HttpCode(HttpStatus.OK)
    @Permissions('devices:terminals:write')
    async pairTerminal(
        @Body() dto: PairTerminalDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.bg3.guard(
            {
                req,
                scope: 'devices.terminals.pair',
                routeMethod: 'POST',
                routePath: '/api/devices/terminals/pair',
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.devices.pairTerminal(ctx, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    @Patch('terminals/:id/unpair')
    @HttpCode(HttpStatus.OK)
    @Permissions('devices:terminals:write')
    async unpairTerminal(
        @Param('id') id: string,
        @Body() dto: UnpairTerminalDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.bg3.guard(
            {
                req,
                scope: 'devices.terminals.unpair',
                routeMethod: 'PATCH',
                routePath: `/api/devices/terminals/${id}/unpair`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.devices.unpairTerminal(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── Device list / detail / history / status ───────────────────
    // NOTE: these `:id`-based routes MUST be declared after the static
    // segments above (`activate`, `kds/register`, `printers/routes`,
    // `terminals/pair`) so Nest does not treat those literal segments
    // as device ids.

    @Get()
    @Permissions('devices:read')
    async list(@Query() query: ListDevicesDto, @Req() req: Request) {
        const ctx = this.ctxOf(req);
        return this.devices.listDevices(ctx, query);
    }

    @Get(':id/history')
    @Permissions('devices:read')
    async history(
        @Param('id') id: string,
        @Query() query: DeviceHistoryQueryDto,
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.devices.getDeviceHistory(ctx, id, query);
    }

    @Get(':id')
    @Permissions('devices:read')
    async detail(
        @Param('id') id: string,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.devices.getDevice(ctx, id, {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }

    @Patch(':id/status')
    @HttpCode(HttpStatus.OK)
    @Permissions('devices:status:write')
    async updateStatus(
        @Param('id') id: string,
        @Body() dto: UpdateDeviceStatusDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        const ctx = this.ctxOf(req);
        return this.bg3.guard(
            {
                req,
                scope: 'devices.status.write',
                routeMethod: 'PATCH',
                routePath: `/api/devices/${id}/status`,
                category: null,
                idempotencyMode: 'optional',
                fingerprintSource: { id, dto },
                actorUserId: user.id,
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
            },
            () =>
                this.devices.updateDeviceStatus(ctx, id, dto, {
                    userId: user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                }),
        );
    }

    // ── helpers ───────────────────────────────────────────────────

    private ctxOf(req: Request) {
        return (req as { branchContext?: { branchId: string; organizationId: string } })
            .branchContext!;
    }
}
