import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
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

interface BranchContext {
    organizationId: string;
    branchId: string;
}

interface ActorMeta {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * BG5 — Audit actions emitted by the device / printer / terminal registry.
 * Same `AuditLog` table the BG2 audit timeline reads from, so device history
 * is automatically picked up by `/api/audit/timeline`.
 */
export const DEVICE_AUDIT_ACTIONS = {
    ACTIVATED: 'DEVICE_ACTIVATED',
    VIEWED: 'DEVICE_VIEWED',
    STATUS_CHANGED: 'DEVICE_STATUS_CHANGED',
    KDS_REGISTERED: 'KDS_DEVICE_REGISTERED',
    PRINTER_ROUTE_CONFIGURED: 'PRINTER_ROUTE_CONFIGURED',
    PRINTER_ROUTE_DISABLED: 'PRINTER_ROUTE_DISABLED',
    TERMINAL_PAIRED: 'TERMINAL_PAIRED',
    TERMINAL_UNPAIRED: 'TERMINAL_UNPAIRED',
} as const;

const HISTORY_ACTIONS = Object.values(DEVICE_AUDIT_ACTIONS);

const DEVICE_AUDIT_ENTITY = 'device';

/**
 * BG5 — Device / Printer / Terminal Registry service.
 *
 * Pure registry/configuration layer. No physical hardware integration is
 * attempted — printer routes and terminal pairings are metadata only and are
 * clearly labelled as such in the response payloads (`mode: 'STUB'` for
 * payment terminals, no driver invocation for printers).
 */
@Injectable()
export class DeviceRegistryService {
    private readonly log = new Logger(DeviceRegistryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ──────────────────────────────────────────────────────────────────
    // Device CRUD
    // ──────────────────────────────────────────────────────────────────

    async activateDevice(
        ctx: BranchContext,
        dto: ActivateDeviceDto,
        actor: ActorMeta,
    ) {
        const code = (dto.activationCode ?? this.generateActivationCode()).trim();

        // Idempotent on activationCode: same code → return the existing row
        // unmodified (must belong to the same branch / org or it's a conflict).
        const existing = await this.prisma.device.findUnique({
            where: { activationCode: code },
        });
        if (existing) {
            if (existing.branchId !== ctx.branchId || existing.orgId !== ctx.organizationId) {
                throw new ConflictException({
                    code: 'DEVICE_ACTIVATION_CODE_BRANCH_MISMATCH',
                    message: 'activationCode is already registered to a different branch/org',
                });
            }
            return {
                ok: true,
                action: 'DEVICE_ALREADY_ACTIVATED',
                device: this.serializeDevice(existing),
            };
        }

        // Per-branch unique name guard (Prisma will throw on race anyway).
        const dupeName = await this.prisma.device.findUnique({
            where: { branchId_name: { branchId: ctx.branchId, name: dto.name } },
        });
        if (dupeName) {
            throw new ConflictException({
                code: 'DEVICE_NAME_CONFLICT',
                message: `A device named "${dto.name}" already exists in this branch`,
            });
        }

        const device = await this.prisma.device.create({
            data: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                type: dto.type,
                name: dto.name,
                station: dto.station ?? null,
                activationCode: code,
                status: 'ACTIVE',
                capabilities: this.toJsonInput(dto.capabilities),
                metadata: this.toJsonInput(dto.metadata),
            },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: DEVICE_AUDIT_ACTIONS.ACTIVATED,
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: device.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                type: device.type,
                name: device.name,
                station: device.station,
                activationCode: device.activationCode,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: DEVICE_AUDIT_ACTIONS.ACTIVATED,
            device: this.serializeDevice(device),
        };
    }

    async registerKdsDevice(
        ctx: BranchContext,
        dto: RegisterKdsDeviceDto,
        actor: ActorMeta,
    ) {
        const result = await this.activateDevice(
            ctx,
            {
                type: 'KDS_SCREEN',
                name: dto.name,
                station: dto.station,
                activationCode: dto.activationCode,
                capabilities: dto.capabilities,
                metadata: dto.metadata,
            } as ActivateDeviceDto,
            actor,
        );

        // Record an additional KDS_REGISTERED audit row to make the KDS
        // surface visible in /api/devices/:id/history without polluting
        // the generic activation audit.
        await this.audit.log({
            actorUserId: actor.userId,
            action: DEVICE_AUDIT_ACTIONS.KDS_REGISTERED,
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: result.device.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                station: dto.station,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: DEVICE_AUDIT_ACTIONS.KDS_REGISTERED,
            device: result.device,
        };
    }

    async listDevices(ctx: BranchContext, query: ListDevicesDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const where: Prisma.DeviceWhereInput = {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            ...(query.type ? { type: query.type } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.station ? { station: query.station } : {}),
        };
        const [total, rows] = await Promise.all([
            this.prisma.device.count({ where }),
            this.prisma.device.findMany({
                where,
                orderBy: [{ type: 'asc' }, { name: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            data: rows.map((d) => this.serializeDevice(d)),
            total,
            page,
            pageSize,
        };
    }

    async getDevice(ctx: BranchContext, id: string, actor: ActorMeta) {
        const device = await this.loadDevice(ctx, id);
        // Fire-and-forget view audit (read-side; never blocks the response).
        this.audit
            .log({
                actorUserId: actor.userId,
                action: DEVICE_AUDIT_ACTIONS.VIEWED,
                entityType: DEVICE_AUDIT_ENTITY,
                entityId: device.id,
                metadata: {
                    orgId: ctx.organizationId,
                    branchId: ctx.branchId,
                    type: device.type,
                    name: device.name,
                },
                ipAddress: actor.ipAddress ?? undefined,
                userAgent: actor.userAgent ?? undefined,
            })
            .catch((err) => this.log.warn(`audit DEVICE_VIEWED failed: ${err}`));

        const routes =
            device.type === 'PRINTER'
                ? await this.prisma.printerRoute.findMany({
                    where: { branchId: ctx.branchId, printerId: device.id },
                    orderBy: [{ routeType: 'asc' }, { priority: 'asc' }],
                })
                : [];

        return {
            ...this.serializeDevice(device),
            routes: routes.map((r) => this.serializePrinterRoute(r)),
        };
    }

    async updateDeviceStatus(
        ctx: BranchContext,
        id: string,
        dto: UpdateDeviceStatusDto,
        actor: ActorMeta,
    ) {
        const device = await this.loadDevice(ctx, id);

        if (device.status === dto.status) {
            return {
                ok: true,
                action: 'DEVICE_STATUS_UNCHANGED',
                device: this.serializeDevice(device),
            };
        }

        // Reject illegal transitions: a RETIRED device cannot be re-activated.
        if (device.status === 'RETIRED') {
            throw new BadRequestException({
                code: 'DEVICE_STATUS_TRANSITION_INVALID',
                message: 'A RETIRED device cannot change status',
            });
        }

        const updated = await this.prisma.device.update({
            where: { id: device.id },
            data: { status: dto.status },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: DEVICE_AUDIT_ACTIONS.STATUS_CHANGED,
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: device.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                from: device.status,
                to: dto.status,
                reason: dto.reason ?? null,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: DEVICE_AUDIT_ACTIONS.STATUS_CHANGED,
            device: this.serializeDevice(updated),
        };
    }

    async getDeviceHistory(
        ctx: BranchContext,
        id: string,
        query: DeviceHistoryQueryDto,
    ) {
        // Asserts the device belongs to ctx (404 otherwise).
        await this.loadDevice(ctx, id);
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const where: Prisma.AuditLogWhereInput = {
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: id,
            action: { in: HISTORY_ACTIONS as string[] },
        };
        const [total, rows] = await Promise.all([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            deviceId: id,
            data: rows.map((r) => ({
                id: r.id,
                action: r.action,
                actorUserId: r.actorUserId,
                metadata: r.metadata,
                createdAt: r.createdAt,
            })),
            total,
            page,
            pageSize,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // Printer Routes
    // ──────────────────────────────────────────────────────────────────

    async upsertPrinterRoute(
        ctx: BranchContext,
        dto: UpsertPrinterRouteDto,
        actor: ActorMeta,
    ) {
        const printer = await this.loadDevice(ctx, dto.printerId);
        if (printer.type !== 'PRINTER') {
            throw new BadRequestException({
                code: 'DEVICE_NOT_PRINTER',
                message: `Device ${printer.id} is type ${printer.type}, expected PRINTER`,
            });
        }
        if (printer.status !== 'ACTIVE') {
            throw new BadRequestException({
                code: 'PRINTER_NOT_ACTIVE',
                message: `Printer is in status ${printer.status}; only ACTIVE printers can be routed`,
            });
        }

        const station = dto.station ?? null;
        const enabled = dto.enabled ?? true;
        const priority = dto.priority ?? 100;

        // Manual upsert against the composite unique
        // (branchId, routeType, station, printerId).
        const existing = await this.prisma.printerRoute.findFirst({
            where: {
                branchId: ctx.branchId,
                routeType: dto.routeType,
                station,
                printerId: printer.id,
            },
        });

        const route = existing
            ? await this.prisma.printerRoute.update({
                where: { id: existing.id },
                data: { enabled, priority },
            })
            : await this.prisma.printerRoute.create({
                data: {
                    orgId: ctx.organizationId,
                    branchId: ctx.branchId,
                    printerId: printer.id,
                    routeType: dto.routeType,
                    station,
                    enabled,
                    priority,
                },
            });

        const action = enabled
            ? DEVICE_AUDIT_ACTIONS.PRINTER_ROUTE_CONFIGURED
            : DEVICE_AUDIT_ACTIONS.PRINTER_ROUTE_DISABLED;

        await this.audit.log({
            actorUserId: actor.userId,
            action,
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: printer.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                routeId: route.id,
                routeType: route.routeType,
                station: route.station,
                enabled: route.enabled,
                priority: route.priority,
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action,
            route: this.serializePrinterRoute(route),
        };
    }

    async listPrinterRoutes(ctx: BranchContext, query: ListPrinterRoutesDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 100;
        const where: Prisma.PrinterRouteWhereInput = {
            branchId: ctx.branchId,
            orgId: ctx.organizationId,
            ...(query.routeType ? { routeType: query.routeType } : {}),
            ...(query.printerId ? { printerId: query.printerId } : {}),
            ...(query.station ? { station: query.station } : {}),
            ...(query.enabledOnly ? { enabled: true } : {}),
        };
        const [total, rows] = await Promise.all([
            this.prisma.printerRoute.count({ where }),
            this.prisma.printerRoute.findMany({
                where,
                orderBy: [{ routeType: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            data: rows.map((r) => this.serializePrinterRoute(r)),
            total,
            page,
            pageSize,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // Terminal Pairing (STUB)
    // ──────────────────────────────────────────────────────────────────

    async pairTerminal(ctx: BranchContext, dto: PairTerminalDto, actor: ActorMeta) {
        const terminal = await this.loadDevice(ctx, dto.terminalDeviceId);
        if (terminal.type !== 'PAYMENT_TERMINAL_STUB') {
            throw new BadRequestException({
                code: 'DEVICE_NOT_PAYMENT_TERMINAL',
                message: `Device ${terminal.id} is type ${terminal.type}, expected PAYMENT_TERMINAL_STUB`,
            });
        }
        const target = await this.loadDevice(ctx, dto.pairedToDeviceId);
        if (target.type !== 'POS_TERMINAL') {
            throw new BadRequestException({
                code: 'PAIR_TARGET_NOT_POS_TERMINAL',
                message: `pairedToDeviceId must reference a POS_TERMINAL (got ${target.type})`,
            });
        }
        if (terminal.pairedToDeviceId && terminal.pairedToDeviceId !== target.id) {
            throw new ConflictException({
                code: 'TERMINAL_ALREADY_PAIRED',
                message: `Terminal is already paired to device ${terminal.pairedToDeviceId}; unpair first`,
            });
        }

        const pairedAt = new Date();
        const provider = dto.provider ?? null;
        const incomingMeta = (terminal.metadata as Record<string, unknown> | null) ?? {};
        const newMeta: Record<string, unknown> = {
            ...incomingMeta,
            ...(dto.metadata ?? {}),
            mode: 'STUB',
            provider,
            pairedAt: pairedAt.toISOString(),
            unpairedAt: null,
        };

        const updated = await this.prisma.device.update({
            where: { id: terminal.id },
            data: {
                pairedToDeviceId: target.id,
                metadata: this.toJsonInput(newMeta) ?? Prisma.JsonNull,
            },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: DEVICE_AUDIT_ACTIONS.TERMINAL_PAIRED,
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: terminal.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                pairedToDeviceId: target.id,
                provider,
                mode: 'STUB',
                pairedAt: pairedAt.toISOString(),
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: DEVICE_AUDIT_ACTIONS.TERMINAL_PAIRED,
            mode: 'STUB',
            terminal: this.serializeDevice(updated),
        };
    }

    async unpairTerminal(
        ctx: BranchContext,
        id: string,
        dto: UnpairTerminalDto,
        actor: ActorMeta,
    ) {
        const terminal = await this.loadDevice(ctx, id);
        if (terminal.type !== 'PAYMENT_TERMINAL_STUB') {
            throw new BadRequestException({
                code: 'DEVICE_NOT_PAYMENT_TERMINAL',
                message: `Device ${terminal.id} is type ${terminal.type}, expected PAYMENT_TERMINAL_STUB`,
            });
        }
        if (!terminal.pairedToDeviceId) {
            return {
                ok: true,
                action: 'TERMINAL_NOT_PAIRED',
                mode: 'STUB',
                terminal: this.serializeDevice(terminal),
            };
        }

        const unpairedAt = new Date();
        const incomingMeta = (terminal.metadata as Record<string, unknown> | null) ?? {};
        const newMeta: Record<string, unknown> = {
            ...incomingMeta,
            mode: 'STUB',
            unpairedAt: unpairedAt.toISOString(),
        };

        const updated = await this.prisma.device.update({
            where: { id: terminal.id },
            data: {
                pairedToDeviceId: null,
                metadata: this.toJsonInput(newMeta) ?? Prisma.JsonNull,
            },
        });

        await this.audit.log({
            actorUserId: actor.userId,
            action: DEVICE_AUDIT_ACTIONS.TERMINAL_UNPAIRED,
            entityType: DEVICE_AUDIT_ENTITY,
            entityId: terminal.id,
            metadata: {
                orgId: ctx.organizationId,
                branchId: ctx.branchId,
                previouslyPairedToDeviceId: terminal.pairedToDeviceId,
                reason: dto.reason ?? null,
                mode: 'STUB',
                unpairedAt: unpairedAt.toISOString(),
            },
            ipAddress: actor.ipAddress ?? undefined,
            userAgent: actor.userAgent ?? undefined,
        });

        return {
            ok: true,
            action: DEVICE_AUDIT_ACTIONS.TERMINAL_UNPAIRED,
            mode: 'STUB',
            terminal: this.serializeDevice(updated),
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    private async loadDevice(ctx: BranchContext, id: string) {
        const device = await this.prisma.device.findFirst({
            where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
        });
        if (!device) {
            throw new NotFoundException({
                code: 'DEVICE_NOT_FOUND',
                message: `Device ${id} not found in this branch`,
            });
        }
        return device;
    }

    private serializeDevice(d: {
        id: string;
        orgId: string;
        branchId: string;
        type: string;
        name: string;
        station: string | null;
        activationCode: string;
        status: string;
        pairedToDeviceId: string | null;
        capabilities: Prisma.JsonValue | null;
        metadata: Prisma.JsonValue | null;
        lastSeenAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }) {
        return {
            id: d.id,
            orgId: d.orgId,
            branchId: d.branchId,
            type: d.type,
            name: d.name,
            station: d.station,
            activationCode: d.activationCode,
            status: d.status,
            pairedToDeviceId: d.pairedToDeviceId,
            capabilities: d.capabilities,
            metadata: d.metadata,
            lastSeenAt: d.lastSeenAt,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        };
    }

    private serializePrinterRoute(r: {
        id: string;
        orgId: string;
        branchId: string;
        printerId: string;
        routeType: string;
        station: string | null;
        enabled: boolean;
        priority: number;
        createdAt: Date;
        updatedAt: Date;
    }) {
        return {
            id: r.id,
            orgId: r.orgId,
            branchId: r.branchId,
            printerId: r.printerId,
            routeType: r.routeType,
            station: r.station,
            enabled: r.enabled,
            priority: r.priority,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        };
    }

    private toJsonInput(
        v: Record<string, unknown> | undefined | null,
    ): Prisma.InputJsonValue | undefined {
        if (v === undefined || v === null) return undefined;
        return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
    }

    private generateActivationCode(): string {
        return `act-${randomBytes(8).toString('hex')}`;
    }
}
