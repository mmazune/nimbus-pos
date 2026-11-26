import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { ActorLike } from '../../common/auth';
import { OrdersService } from '../orders/orders.service';
import { TicketsService } from './tickets.service';

class ReadyQueryDto {
  @IsOptional()
  @IsIn(['mine', 'all'])
  scope?: 'mine' | 'all';
}
class FireDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}
class HoldDto {
  @IsBoolean()
  held!: boolean;
}

type Actor = ActorLike & { id: string };

/** T2 phase 3 (E5): kitchen and bar tickets that close the loop. */
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly orders: OrdersService,
  ) {}

  private meta(req: Request, user?: Actor) {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'], actor: user };
  }

  @Get('kds/stations')
  @Permissions('pos:kds:read')
  stations(@Req() req: Request) {
    return this.tickets.stations((req as any).branchContext);
  }

  @Get('kds/ready')
  @Permissions('pos:orders:read')
  ready(@Query() q: ReadyQueryDto, @CurrentUser() u: Actor, @Req() req: Request) {
    return this.tickets.readyList((req as any).branchContext, u.id, q.scope ?? 'mine');
  }

  @Post('kds/tickets/:id/collected')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  collected(@Param('id') id: string, @CurrentUser() u: Actor, @Req() req: Request) {
    return this.tickets.collected((req as any).branchContext, u.id, id, this.meta(req));
  }

  @Get('floor/state')
  @Permissions('pos:table:read')
  floorState(@Req() req: Request) {
    return this.tickets.floorState((req as any).branchContext);
  }

  @Post('pos/orders/:id/lines/:itemId/hold')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  hold(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: HoldDto,
    @CurrentUser() u: Actor,
    @Req() req: Request,
  ) {
    return this.orders.setLineHeld(
      u.id,
      (req as any).branchContext,
      id,
      itemId,
      dto.held,
      this.meta(req, u),
    );
  }

  @Post('pos/orders/:id/fire')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  fire(
    @Param('id') id: string,
    @Body() dto: FireDto,
    @CurrentUser() u: Actor,
    @Req() req: Request,
  ) {
    return this.orders.fireOrder(
      u.id,
      (req as any).branchContext,
      id,
      dto.itemIds,
      this.meta(req, u),
    );
  }

  @Post('pos/orders/:id/fire/:fireId/undo')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  undo(
    @Param('id') id: string,
    @Param('fireId') fireId: string,
    @CurrentUser() u: Actor,
    @Req() req: Request,
  ) {
    return this.orders.undoFire(u.id, (req as any).branchContext, id, fireId, this.meta(req, u));
  }
}
