import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { ListKdsQueueQueryDto, UpdateKdsSlaDto } from './dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ── Types ──

interface BranchContext {
  branchId: string;
  organizationId: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// ── Default SLA (seconds) ──

const DEFAULT_SLA = { greenSeconds: 300, amberSeconds: 600, redSeconds: 900 };

// ── KDS Event Types ──

export type KdsEventType = 'NEW_TICKET' | 'TICKET_CHANGED' | 'TICKET_READY' | 'TICKET_RECALLED';

export interface KdsEvent {
  eventType: KdsEventType;
  ticketId: string;
  orderId: string;
  station: string;
  status: string;
  urgencyState: string;
  elapsedSeconds: number;
  at: string;
  branchId: string;
}

@Injectable()
export class KdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Create Tickets for lines (E1) ──
  //
  // Tickets are made for exactly the lines just sent, one ticket per station. Runs inside the
  // send transaction. `kds_ticket_items.order_item_id` is unique, so a line can never be
  // ticketed twice even if two sends race; the order row lock taken by the caller makes the
  // second send find nothing unsent in the first place.
  async createTicketsForLines(
    tx: Prisma.TransactionClient,
    ctx: BranchContext,
    orderId: string,
    orderItemIds: string[],
  ): Promise<{ id: string; station: string }[]> {
    const lines = await tx.orderItem.findMany({
      where: { id: { in: orderItemIds }, orderId, voidedAt: null },
      include: { menuItem: { select: { station: true } } },
    });

    // Group by station, exclude NONE
    const stationGroups: Record<string, string[]> = {};
    for (const line of lines) {
      const station = line.menuItem.station;
      if (station === 'NONE') continue;
      (stationGroups[station] ??= []).push(line.id);
    }

    const tickets: { id: string; station: string }[] = [];
    for (const [station, ids] of Object.entries(stationGroups)) {
      const ticket = await tx.kdsTicket.create({
        data: {
          orgId: ctx.organizationId,
          branchId: ctx.branchId,
          orderId,
          station,
          status: 'QUEUED',
          items: { create: ids.map((orderItemId) => ({ orderItemId })) },
        },
      });
      tickets.push({ id: ticket.id, station });
      await tx.auditLog.create({
        data: {
          action: 'KDS_TICKET_CREATED',
          entityType: 'kdsTicket',
          entityId: ticket.id,
          metadata: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            orderId,
            station,
            itemCount: ids.length,
          },
        },
      });
    }
    return tickets;
  }

  /** Tell the screens a ticket exists. Called after the send transaction has committed. */
  announceTickets(ctx: BranchContext, orderId: string, tickets: { id: string; station: string }[]) {
    for (const t of tickets) {
      this.emitKdsEvent({
        eventType: 'NEW_TICKET',
        ticketId: t.id,
        orderId,
        station: t.station,
        status: 'QUEUED',
        urgencyState: 'GREEN',
        elapsedSeconds: 0,
        at: new Date().toISOString(),
        branchId: ctx.branchId,
      });
    }
  }

  // ── Get Queue ──

  async getQueue(ctx: BranchContext, query: ListKdsQueueQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      branchId: ctx.branchId,
      orgId: ctx.organizationId,
    };
    if (query.station) where.station = query.station;
    if (query.status) where.status = query.status;

    const tickets = await this.prisma.kdsTicket.findMany({
      where,
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: { select: { id: true, name: true, station: true } },
                menuItemServing: { select: { id: true, format: true, label: true } },
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            serviceType: true,
            tableId: true,
            notes: true,
            table: { select: { id: true, label: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
    });

    const total = await this.prisma.kdsTicket.count({ where });

    // Load SLA configs for all relevant stations
    const stations = [...new Set(tickets.map((t) => t.station))];
    const slaConfigs = await this.prisma.kdsSlaConfig.findMany({
      where: { branchId: ctx.branchId, station: { in: stations } },
    });
    const slaMap: Record<
      string,
      { greenSeconds: number; amberSeconds: number; redSeconds: number }
    > = {};
    for (const sla of slaConfigs) {
      slaMap[sla.station] = {
        greenSeconds: sla.greenSeconds,
        amberSeconds: sla.amberSeconds,
        redSeconds: sla.redSeconds,
      };
    }

    const now = new Date();
    const enriched = tickets.map((ticket) => {
      const sla = slaMap[ticket.station] || DEFAULT_SLA;
      const elapsedMs = now.getTime() - new Date(ticket.startedAt).getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      let urgencyState: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
      if (elapsedSeconds >= sla.redSeconds) {
        urgencyState = 'RED';
      } else if (elapsedSeconds >= sla.amberSeconds) {
        urgencyState = 'AMBER';
      }

      const remainingSecondsToAmber = Math.max(0, sla.amberSeconds - elapsedSeconds);
      const remainingSecondsToRed = Math.max(0, sla.redSeconds - elapsedSeconds);

      return {
        id: ticket.id,
        orderId: ticket.orderId,
        orderNumber: ticket.order.orderNumber,
        serviceType: ticket.order.serviceType,
        table: ticket.order.table,
        orderNotes: ticket.order.notes,
        station: ticket.station,
        status: ticket.status,
        createdAt: ticket.createdAt,
        startedAt: ticket.startedAt,
        readyAt: ticket.readyAt,
        recalledAt: ticket.recalledAt,
        elapsedSeconds,
        amberAtSeconds: sla.amberSeconds,
        redAtSeconds: sla.redSeconds,
        remainingSecondsToAmber,
        remainingSecondsToRed,
        urgencyState,
        isNew: elapsedSeconds < 10,
        isRecalled: ticket.status === 'RECALLED',
        items: ticket.items.map((ti) => ({
          id: ti.id,
          orderItemId: ti.orderItemId,
          quantity: ti.orderItem.quantity,
          menuItemName: ti.orderItem.menuItem.name,
          menuItemId: ti.orderItem.menuItem.id,
          serving: ti.orderItem.menuItemServing,
          notes: ti.orderItem.notes,
          // E1 — a voided line stays on the ticket, flagged
          voided: ti.voidedAt !== null,
          voidedAt: ti.voidedAt,
          voidReason: ti.voidReason,
          wasMade: ti.wasMade,
        })),
      };
    });

    // Sort: RED first, then AMBER, then GREEN; within each band oldest first
    const urgencyOrder = { RED: 0, AMBER: 1, GREEN: 2 };
    enriched.sort((a, b) => {
      const urgA = urgencyOrder[a.urgencyState as keyof typeof urgencyOrder] ?? 2;
      const urgB = urgencyOrder[b.urgencyState as keyof typeof urgencyOrder] ?? 2;
      if (urgA !== urgB) return urgA - urgB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return { data: enriched, total, page, pageSize };
  }

  // ── Mark Ready ──

  async markReady(userId: string, ctx: BranchContext, ticketId: string, meta: RequestMeta) {
    const ticket = await this.prisma.kdsTicket.findFirst({
      where: { id: ticketId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!ticket) throw new NotFoundException('KDS ticket not found');

    if (ticket.status === 'READY') {
      throw new ConflictException('Ticket is already READY');
    }

    const updated = await this.prisma.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'READY',
        readyAt: new Date(),
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'KDS_TICKET_READY',
      entityType: 'kdsTicket',
      entityId: ticketId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: ticket.orderId,
        station: ticket.station,
        previousStatus: ticket.status,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const sla = await this.getSlaForStation(ctx.branchId, ticket.station);
    const elapsedSeconds = Math.floor(
      (new Date().getTime() - new Date(ticket.startedAt).getTime()) / 1000,
    );

    this.emitKdsEvent({
      eventType: 'TICKET_READY',
      ticketId,
      orderId: ticket.orderId,
      station: ticket.station,
      status: 'READY',
      urgencyState: this.computeUrgency(elapsedSeconds, sla),
      elapsedSeconds,
      at: new Date().toISOString(),
      branchId: ctx.branchId,
    });

    return updated;
  }

  // ── Recall ──

  async recallTicket(userId: string, ctx: BranchContext, ticketId: string, meta: RequestMeta) {
    const ticket = await this.prisma.kdsTicket.findFirst({
      where: { id: ticketId, branchId: ctx.branchId, orgId: ctx.organizationId },
    });
    if (!ticket) throw new NotFoundException('KDS ticket not found');

    if (ticket.status !== 'READY') {
      throw new ConflictException('Only READY tickets can be recalled');
    }

    const updated = await this.prisma.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RECALLED',
        recalledAt: new Date(),
        readyAt: null,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'KDS_TICKET_RECALLED',
      entityType: 'kdsTicket',
      entityId: ticketId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: ticket.orderId,
        station: ticket.station,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const sla = await this.getSlaForStation(ctx.branchId, ticket.station);
    const elapsedSeconds = Math.floor(
      (new Date().getTime() - new Date(ticket.startedAt).getTime()) / 1000,
    );

    this.emitKdsEvent({
      eventType: 'TICKET_RECALLED',
      ticketId,
      orderId: ticket.orderId,
      station: ticket.station,
      status: 'RECALLED',
      urgencyState: this.computeUrgency(elapsedSeconds, sla),
      elapsedSeconds,
      at: new Date().toISOString(),
      branchId: ctx.branchId,
    });

    return updated;
  }

  // ── SLA Config ──

  async getSlaConfig(ctx: BranchContext, station: string) {
    const config = await this.prisma.kdsSlaConfig.findUnique({
      where: { branchId_station: { branchId: ctx.branchId, station } },
    });

    if (!config) {
      return {
        station,
        branchId: ctx.branchId,
        ...DEFAULT_SLA,
        isDefault: true,
      };
    }

    return {
      id: config.id,
      station: config.station,
      branchId: config.branchId,
      greenSeconds: config.greenSeconds,
      amberSeconds: config.amberSeconds,
      redSeconds: config.redSeconds,
      isDefault: false,
    };
  }

  async updateSlaConfig(
    userId: string,
    ctx: BranchContext,
    station: string,
    dto: UpdateKdsSlaDto,
    meta: RequestMeta,
  ) {
    if (dto.greenSeconds > dto.amberSeconds || dto.amberSeconds > dto.redSeconds) {
      throw new BadRequestException(
        'SLA thresholds must satisfy greenSeconds <= amberSeconds <= redSeconds',
      );
    }

    const config = await this.prisma.kdsSlaConfig.upsert({
      where: { branchId_station: { branchId: ctx.branchId, station } },
      update: {
        greenSeconds: dto.greenSeconds,
        amberSeconds: dto.amberSeconds,
        redSeconds: dto.redSeconds,
      },
      create: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        station,
        greenSeconds: dto.greenSeconds,
        amberSeconds: dto.amberSeconds,
        redSeconds: dto.redSeconds,
      },
    });

    await this.audit.log({
      actorUserId: userId,
      action: 'KDS_SLA_UPDATED',
      entityType: 'kdsSlaConfig',
      entityId: config.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        station,
        greenSeconds: dto.greenSeconds,
        amberSeconds: dto.amberSeconds,
        redSeconds: dto.redSeconds,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return config;
  }

  // ── Helpers ──

  private async getSlaForStation(
    branchId: string,
    station: string,
  ): Promise<{ greenSeconds: number; amberSeconds: number; redSeconds: number }> {
    const config = await this.prisma.kdsSlaConfig.findUnique({
      where: { branchId_station: { branchId, station } },
    });
    return config
      ? {
          greenSeconds: config.greenSeconds,
          amberSeconds: config.amberSeconds,
          redSeconds: config.redSeconds,
        }
      : DEFAULT_SLA;
  }

  private computeUrgency(
    elapsedSeconds: number,
    sla: { greenSeconds: number; amberSeconds: number; redSeconds: number },
  ): string {
    if (elapsedSeconds >= sla.redSeconds) return 'RED';
    if (elapsedSeconds >= sla.amberSeconds) return 'AMBER';
    return 'GREEN';
  }

  private emitKdsEvent(event: KdsEvent): void {
    this.eventEmitter.emit('kds.update', event);
  }
}
