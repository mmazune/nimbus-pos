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
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, fromEvent, map, filter } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KdsService, KdsEvent } from './kds.service';
import { ListKdsQueueQueryDto, UpdateKdsSlaDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller()
export class KdsController {
  constructor(
    private readonly kdsService: KdsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── KDS Queue ──

  @Get('kds/queue')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:kds:read')
  async getQueue(@Query() query: ListKdsQueueQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.kdsService.getQueue(ctx, query);
  }

  // ── SLA Config ──

  @Get('kds/sla-config/:station')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:kds:read')
  async getSlaConfig(@Param('station') station: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.kdsService.getSlaConfig(ctx, station);
  }

  @Patch('kds/sla-config/:station')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:kds:sla:write')
  async updateSlaConfig(
    @Param('station') station: string,
    @Body() dto: UpdateKdsSlaDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.kdsService.updateSlaConfig(user.id, ctx, station, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Ticket Actions ──

  @Post('kds/tickets/:id/mark-ready')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:kds:write')
  async markReady(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.kdsService.markReady(user.id, ctx, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('kds/tickets/:id/recall')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:kds:write')
  async recallTicket(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.kdsService.recallTicket(user.id, ctx, id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── SSE Stream ──

  @Sse('stream/kds')
  @UseGuards(JwtAuthGuard, BranchContextGuard)
  @RequireBranchContext()
  kdsStream(@Req() req: Request, @Query('station') station?: string): Observable<MessageEvent> {
    const ctx = (req as any).branchContext;
    const branchId = ctx.branchId;

    return fromEvent<KdsEvent>(this.eventEmitter, 'kds.update').pipe(
      filter((event) => {
        if (event.branchId !== branchId) return false;
        if (station && event.station !== station) return false;
        return true;
      }),
      map((event) => ({
        data: event,
        type: event.eventType,
      })),
    );
  }
}
