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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  ConfirmReservationDto,
  SeatReservationDto,
  CancelReservationDto,
  MarkNoShowDto,
  RecordDepositDto,
  ListReservationsQueryDto,
  AssignTableDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('reservations')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Permissions('pos:reservation:create')
  async create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.create(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @Permissions('pos:reservation:read')
  async list(@Query() query: ListReservationsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.list(ctx, query);
  }

  @Get('upcoming')
  @Permissions('pos:reservation:read')
  async listUpcoming(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.listUpcoming(ctx);
  }

  @Get(':id')
  @Permissions('pos:reservation:read')
  async findById(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.findById(id, ctx);
  }

  @Patch(':id/confirm')
  @Permissions('pos:reservation:confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmReservationDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.confirm(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/seat')
  @Permissions('pos:reservation:seat')
  @HttpCode(HttpStatus.OK)
  async seat(
    @Param('id') id: string,
    @Body() dto: SeatReservationDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.seat(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/cancel')
  @Permissions('pos:reservation:cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.cancel(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/no-show')
  @Permissions('pos:reservation:no-show')
  @HttpCode(HttpStatus.OK)
  async markNoShow(
    @Param('id') id: string,
    @Body() dto: MarkNoShowDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.markNoShow(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/deposits')
  @Permissions('pos:reservation:deposit:record')
  async recordDeposit(
    @Param('id') id: string,
    @Body() dto: RecordDepositDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.recordDeposit(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':id/deposits')
  @Permissions('pos:reservation:deposit:read')
  async getDeposits(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.getDeposits(id, ctx);
  }

  @Get(':id/events')
  @Permissions('pos:reservation:read')
  async getEvents(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.getEvents(id, ctx);
  }

  @Patch(':id/assign-table')
  @Permissions('pos:reservation:table:assign')
  @HttpCode(HttpStatus.OK)
  async assignTable(
    @Param('id') id: string,
    @Body() dto: AssignTableDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.reservationsService.assignTable(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
