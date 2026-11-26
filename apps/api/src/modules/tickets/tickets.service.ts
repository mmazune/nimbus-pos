import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PrepStation } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { OrdersService } from '../orders/orders.service';

interface Ctx {
  branchId: string;
  organizationId: string;
}
interface Meta {
  ipAddress?: string;
  userAgent?: string;
}

/** The stations a branch can have (PrepStation without NONE), in this order. */
export const STATIONS: PrepStation[] = ['KITCHEN', 'BAR', 'COLD_KITCHEN', 'DESSERT'];
const DEFAULT_SLA = { greenSeconds: 300, amberSeconds: 600, redSeconds: 900 };
const OPEN = { notIn: [OrderStatus.CLOSED, OrderStatus.VOIDED] };

export type TableState = 'FREE' | 'JOINED' | 'OPEN' | 'NOT_SENT' | 'SENT' | 'READY' | 'LATE';

/**
 * T2 phase 3 (E5): closing the loop between the kitchen and the waiter. Ready, Collected and
 * late live on tickets; the table's state is derived here from lines and tickets and never
 * written (TICKET_LATE and READY_WAITING are states, not alert rows).
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  private async slaMap(branchId: string) {
    const rows = await this.prisma.kdsSlaConfig.findMany({ where: { branchId } });
    const map = new Map(rows.map((r) => [r.station, r]));
    return (station: string) => {
      const r = map.get(station);
      return r
        ? {
            greenSeconds: r.greenSeconds,
            amberSeconds: r.amberSeconds,
            redSeconds: r.redSeconds,
            configured: true,
          }
        : { ...DEFAULT_SLA, configured: false };
    };
  }

  /** Stations listed per branch as settings, each with its late times (KdsSlaConfig). */
  async stations(ctx: Ctx) {
    const sla = await this.slaMap(ctx.branchId);
    return { stations: STATIONS.map((station) => ({ station, ...sla(station) })) };
  }

  /** What is ready and not yet collected; "mine" is every table the caller holds now. */
  async readyList(ctx: Ctx, userId: string, scope: 'mine' | 'all') {
    await this.orders.releaseDueFires(ctx.branchId);
    const tickets = await this.prisma.kdsTicket.findMany({
      where: {
        branchId: ctx.branchId,
        orgId: ctx.organizationId,
        status: 'READY',
        collectedAt: null,
      },
      orderBy: [{ readyAt: 'asc' }, { id: 'asc' }],
      include: {
        items: {
          where: { voidedAt: null },
          include: {
            orderItem: {
              select: {
                quantity: true,
                allergy: true,
                takeaway: true,
                menuItem: { select: { name: true } },
                order: {
                  select: {
                    id: true,
                    userId: true,
                    table: { select: { id: true, label: true } },
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const out = tickets
      .filter((t) => t.items.length > 0)
      .map((t) => {
        const order = t.items[0].orderItem.order; // the line's CURRENT order
        return {
          id: t.id,
          station: t.station,
          orderId: order.id,
          tableId: order.table?.id ?? null,
          tableLabel: order.table?.label ?? null,
          waiterUserId: order.userId,
          waiter: `${order.user.firstName} ${order.user.lastName?.[0] ?? ''}.`.trim(),
          readyAt: t.readyAt,
          items: t.items.map((i) => ({
            name: i.orderItem.menuItem.name,
            quantity: i.orderItem.quantity,
            allergy: i.orderItem.allergy,
            takeaway: i.orderItem.takeaway,
          })),
        };
      })
      .filter((t) => scope === 'all' || t.waiterUserId === userId);
    return { scope, tickets: out };
  }

  /** The waiter took it from the pass. Once; the time is kept. */
  async collected(ctx: Ctx, userId: string, ticketId: string, meta: Meta) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.kdsTicket.findFirst({
        where: { id: ticketId, branchId: ctx.branchId, orgId: ctx.organizationId },
      });
      if (!t) throw new NotFoundException('KDS ticket not found');
      const now = new Date();
      const claimed = await tx.kdsTicket.updateMany({
        where: { id: ticketId, status: 'READY', collectedAt: null },
        data: { collectedAt: now, collectedById: userId },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          t.collectedAt
            ? 'This ticket was already collected'
            : 'Only a ready ticket can be collected',
        );
      }
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'KDS_TICKET_COLLECTED',
          entityType: 'kdsTicket',
          entityId: ticketId,
          metadata: {
            orgId: ctx.organizationId,
            branchId: ctx.branchId,
            station: t.station,
            readyAt: t.readyAt,
          },
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
      return tx.kdsTicket.findUniqueOrThrow({ where: { id: ticketId } });
    });
  }

  /**
   * The table's state for the Floor, derived on the server, strongest first:
   * LATE (a ticket past its station's red time), READY (ready, not collected), NOT_SENT (a
   * live line not sent and not held), SENT (everything out), OPEN (an order with no lines),
   * JOINED (part of another table's party), FREE. Lines whose station is NONE make no ticket,
   * so they can only ever read as SENT once sent, never stuck at late.
   */
  async floorState(ctx: Ctx) {
    await this.orders.releaseDueFires(ctx.branchId);
    const now = Date.now();
    const sla = await this.slaMap(ctx.branchId);
    const tables = await this.prisma.table.findMany({
      where: { branchId: ctx.branchId, orgId: ctx.organizationId, isActive: true },
      select: {
        id: true,
        label: true,
        areaId: true,
        isTab: true,
        joinedToTableId: true,
        status: true,
      },
      orderBy: [{ label: 'asc' }],
    });
    const orders = await this.prisma.order.findMany({
      where: { branchId: ctx.branchId, status: OPEN, tableId: { in: tables.map((t) => t.id) } },
      select: {
        id: true,
        tableId: true,
        userId: true,
        items: {
          where: { voidedAt: null },
          select: { id: true, sentAt: true, heldAt: true, fireAt: true },
        },
      },
    });
    const lineIds = orders.flatMap((o) => o.items.map((i) => i.id));
    const ticketItems = lineIds.length
      ? await this.prisma.kdsTicketItem.findMany({
          where: { orderItemId: { in: lineIds }, voidedAt: null },
          select: {
            orderItemId: true,
            ticket: {
              select: { id: true, station: true, status: true, startedAt: true, collectedAt: true },
            },
          },
        })
      : [];
    const ticketsByLine = new Map(ticketItems.map((ti) => [ti.orderItemId, ti.ticket]));

    const byTable = new Map<string, typeof orders>();
    for (const o of orders) {
      const list = byTable.get(o.tableId!) ?? [];
      list.push(o);
      byTable.set(o.tableId!, list);
    }

    return {
      at: new Date(now).toISOString(),
      tables: tables.map((t) => {
        const os = byTable.get(t.id) ?? [];
        const lines = os.flatMap((o) => o.items);
        const tickets = [
          ...new Map(
            lines
              .map((l) => ticketsByLine.get(l.id))
              .filter((x): x is NonNullable<typeof x> => !!x)
              .map((x) => [x.id, x]),
          ).values(),
        ];
        const late = tickets.filter(
          (k) =>
            k.status !== 'READY' && now - k.startedAt.getTime() >= sla(k.station).redSeconds * 1000,
        ).length;
        const ready = tickets.filter((k) => k.status === 'READY' && !k.collectedAt).length;
        const notSent = lines.filter((l) => !l.sentAt && !l.heldAt).length;
        const held = lines.filter((l) => !l.sentAt && l.heldAt).length;
        let state: TableState;
        if (os.length === 0) state = t.joinedToTableId ? 'JOINED' : 'FREE';
        else if (late > 0) state = 'LATE';
        else if (ready > 0) state = 'READY';
        else if (notSent > 0) state = 'NOT_SENT';
        else if (lines.some((l) => l.sentAt)) state = 'SENT';
        else state = 'OPEN';
        return {
          tableId: t.id,
          label: t.label,
          areaId: t.areaId,
          isTab: t.isTab,
          joinedToTableId: t.joinedToTableId,
          state,
          orderIds: os.map((o) => o.id),
          waiterUserIds: [...new Set(os.map((o) => o.userId))],
          counts: { notSent, held, ready, late, tickets: tickets.length },
        };
      }),
    };
  }
}
