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
import { EventsService } from './events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  PublishEventDto,
  OpenEventDto,
  CloseEventDto,
  CreateTicketClassDto,
  CreateBookingDto,
  CancelBookingDto,
  IssueTicketsDto,
  CheckInTicketDto,
  ListEventsQueryDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('events')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ── Events CRUD ──

  @Post()
  @Permissions('pos:event:create')
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.createEvent(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @Permissions('pos:event:read')
  async list(@Query() query: ListEventsQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.eventsService.listEvents(ctx, query);
  }

  @Get('upcoming')
  @Permissions('pos:event:read')
  async listUpcoming(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.eventsService.listUpcoming(ctx);
  }

  @Get('portal/:portalKey')
  @Permissions('pos:event:portal:read')
  async findByPortalKey(@Param('portalKey') portalKey: string) {
    return this.eventsService.findByPortalKey(portalKey);
  }

  @Get(':id')
  @Permissions('pos:event:read')
  async findById(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.eventsService.findEventById(id, ctx);
  }

  @Patch(':id')
  @Permissions('pos:event:update')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.updateEvent(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/publish')
  @Permissions('pos:event:publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('id') id: string,
    @Body() dto: PublishEventDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.publishEvent(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/open')
  @Permissions('pos:event:publish')
  @HttpCode(HttpStatus.OK)
  async open(
    @Param('id') id: string,
    @Body() dto: OpenEventDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.openEvent(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/close')
  @Permissions('pos:event:close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @Body() dto: CloseEventDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.closeEvent(id, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Ticket Classes ──

  @Post(':id/ticket-classes')
  @Permissions('pos:event:update')
  async createTicketClass(
    @Param('id') eventId: string,
    @Body() dto: CreateTicketClassDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.createTicketClass(eventId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':id/ticket-classes')
  @Permissions('pos:event:read')
  async listTicketClasses(@Param('id') eventId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.eventsService.listTicketClasses(eventId, ctx);
  }

  // ── Bookings ──

  @Post(':id/bookings')
  @Permissions('pos:event:booking:create')
  async createBooking(
    @Param('id') eventId: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.createBooking(eventId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':id/bookings')
  @Permissions('pos:event:booking:read')
  async listBookings(@Param('id') eventId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.eventsService.listBookings(eventId, ctx);
  }

  @Get('bookings/:bookingId')
  @Permissions('pos:event:booking:read')
  async findBooking(@Param('bookingId') bookingId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.eventsService.findBookingById(bookingId, ctx);
  }

  @Patch('bookings/:bookingId/cancel')
  @Permissions('pos:event:booking:cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.cancelBooking(bookingId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Tickets ──

  @Post('bookings/:bookingId/tickets/issue')
  @Permissions('pos:event:ticket:issue')
  async issueTickets(
    @Param('bookingId') bookingId: string,
    @Body() dto: IssueTicketsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.issueTickets(bookingId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('tickets/:ticketId/check-in')
  @Permissions('pos:event:checkin')
  async checkInTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: CheckInTicketDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.eventsService.checkInTicket(ticketId, user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
