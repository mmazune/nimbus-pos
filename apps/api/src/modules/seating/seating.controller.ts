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
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { SeatingActor, SeatingService } from './seating.service';
import {
  BulkAddTablesDto,
  ChangeSeatsDto,
  ChangeWaiterDto,
  CreateAreaDto,
  JoinTableDto,
  ListAreasQueryDto,
  MoveLineDto,
  OfferHandoverDto,
  OpenTabDto,
  TargetTableDto,
  UpdateAreaDto,
} from './dto/seating.dto';

/** T2 phase 2 (E3): areas, tabs, and moving people around. */
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class SeatingController {
  constructor(private readonly seating: SeatingService) {}

  private ctx(req: Request) {
    return (req as any).branchContext;
  }
  private meta(req: Request) {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }

  // Areas and tables: Owner, Manager, Supervisor (pos:table:write)
  @Get('areas')
  @Permissions('pos:table:read')
  listAreas(@Query() q: ListAreasQueryDto, @Req() req: Request) {
    return this.seating.listAreas(this.ctx(req), q.includePutAway === 'true');
  }

  @Post('areas')
  @Permissions('pos:table:write')
  createArea(@Body() dto: CreateAreaDto, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.createArea(this.ctx(req), u, dto, this.meta(req));
  }

  @Patch('areas/:id')
  @Permissions('pos:table:write')
  updateArea(
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.updateArea(this.ctx(req), u, id, dto, this.meta(req));
  }

  @Post('areas/:id/put-away')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:table:write')
  putAwayArea(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.putAwayArea(this.ctx(req), u, id, this.meta(req));
  }

  @Post('areas/:id/tables')
  @Permissions('pos:table:write')
  bulkAdd(
    @Param('id') id: string,
    @Body() dto: BulkAddTablesDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.bulkAddTables(this.ctx(req), u, id, dto, this.meta(req));
  }

  @Post('tables/:id/put-away')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:table:write')
  putAwayTable(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.putAwayTable(this.ctx(req), u, id, this.meta(req));
  }

  @Patch('tables/:id/seats')
  @Permissions('pos:table:write')
  seats(
    @Param('id') id: string,
    @Body() dto: ChangeSeatsDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.changeSeats(this.ctx(req), u, id, dto.seats, this.meta(req));
  }

  // Tabs: any waiter (pos:orders:write)
  @Post('areas/:id/tabs')
  @Permissions('pos:orders:write')
  openTab(
    @Param('id') id: string,
    @Body() dto: OpenTabDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.openTab(this.ctx(req), u, id, dto, this.meta(req));
  }

  @Post('tabs/:id/put-away')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  putAwayTab(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.putAwayTable(this.ctx(req), u, id, this.meta(req), true);
  }

  // Moving people around
  @Post('tables/:id/move')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:order:transfer')
  move(
    @Param('id') id: string,
    @Body() dto: TargetTableDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.moveTable(this.ctx(req), u, id, dto.toTableId, this.meta(req));
  }

  @Post('tables/:id/join')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:order:merge')
  join(
    @Param('id') id: string,
    @Body() dto: JoinTableDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.joinTables(this.ctx(req), u, id, dto.tableId, this.meta(req));
  }

  @Post('tables/:id/split')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:order:merge')
  splitJoin(
    @Param('id') id: string,
    @Body() dto: JoinTableDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.splitJoin(this.ctx(req), u, id, dto.tableId, this.meta(req));
  }

  @Post('pos/orders/:id/lines/:itemId/move')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:order:move-items')
  moveLine(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: MoveLineDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.moveLine(this.ctx(req), u, id, itemId, dto, this.meta(req));
  }

  @Post('pos/orders/:id/split-by-guest')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:order:split')
  splitByGuest(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.splitByGuest(this.ctx(req), u, id, this.meta(req));
  }

  @Post('tables/:id/change-waiter')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:order:transfer')
  changeWaiter(
    @Param('id') id: string,
    @Body() dto: ChangeWaiterDto,
    @CurrentUser() u: SeatingActor,
    @Req() req: Request,
  ) {
    return this.seating.changeWaiter(this.ctx(req), u, id, dto.toUserId, this.meta(req));
  }

  // Hand-over: any waiter, for their own tables
  @Post('handovers')
  @Permissions('pos:orders:write')
  offer(@Body() dto: OfferHandoverDto, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.offerHandover(this.ctx(req), u, dto, this.meta(req));
  }

  @Get('handovers')
  @Permissions('pos:orders:read')
  list(@CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.listHandovers(this.ctx(req), u);
  }

  @Post('handovers/:id/accept')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  accept(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.answerHandover(this.ctx(req), u, id, 'accept', this.meta(req));
  }

  @Post('handovers/:id/decline')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  decline(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.answerHandover(this.ctx(req), u, id, 'decline', this.meta(req));
  }

  @Post('handovers/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  cancel(@Param('id') id: string, @CurrentUser() u: SeatingActor, @Req() req: Request) {
    return this.seating.answerHandover(this.ctx(req), u, id, 'cancel', this.meta(req));
  }
}
