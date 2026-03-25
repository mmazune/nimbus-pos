import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Sse,
  MessageEvent,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, fromEvent, map, filter } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentsService, PaymentEvent } from './payments.service';
import {
  CloseOrderDto,
  CreatePaymentIntentDto,
  CancelPaymentIntentDto,
  CreateManualReferencePaymentDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Close Order with Payment ──
  @Post('pos/orders/:id/close')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:orders:close')
  async closeOrderWithPayment(
    @Param('id') id: string,
    @Body() dto: CloseOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.closeOrderWithPayment(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Create MOMO Payment Intent ──
  @Post('payments/intents')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:intent')
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.createPaymentIntent(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Get Payment Intent ──
  @Get('payments/intents/:intentId')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:read')
  async getPaymentIntent(@Param('intentId') intentId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.getPaymentIntent(ctx, intentId);
  }

  // ── Get Payment Intent Status ──
  @Get('payments/intents/:intentId/status')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:read')
  async getPaymentIntentStatus(@Param('intentId') intentId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.getPaymentIntentStatus(ctx, intentId);
  }

  // ── Cancel Payment Intent ──
  @Post('payments/intents/:intentId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:cancel')
  async cancelPaymentIntent(
    @Param('intentId') intentId: string,
    @Body() dto: CancelPaymentIntentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.cancelPaymentIntent(user.id, ctx, intentId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Get Order Payments ──
  @Get('pos/orders/:id/payments')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:read')
  async getOrderPayments(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.getOrderPayments(ctx, id);
  }

  // ── Create Manual Reference Payment ──
  @Post('payments/manual-reference')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:manual-reference')
  async createManualReferencePayment(
    @Body() dto: CreateManualReferencePaymentDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.createManualReferencePayment(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Get Manual Reference Payment ──
  @Get('payments/manual-reference/:paymentId')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:read')
  async getManualReferencePayment(@Param('paymentId') paymentId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.getManualReferencePayment(ctx, paymentId);
  }

  // ── List Manual Reference Payments ──
  @Get('payments/manual-reference')
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:read')
  async listManualReferencePayments(
    @Query('verificationStatus') verificationStatus: string,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.paymentsService.listManualReferencePayments(ctx, verificationStatus);
  }

  // ── MTN Webhook (unauthenticated callback) ──
  @Post('webhooks/mtn')
  @HttpCode(HttpStatus.OK)
  async mtnWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.paymentsService.processWebhook('MTN', payload, headers);
  }

  // ── Airtel Webhook (unauthenticated callback) ──
  @Post('webhooks/airtel')
  @HttpCode(HttpStatus.OK)
  async airtelWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.paymentsService.processWebhook('AIRTEL', payload, headers);
  }

  // ── SSE Payment Stream ──
  @Sse('stream/payments')
  @UseGuards(JwtAuthGuard, BranchContextGuard)
  @RequireBranchContext()
  paymentStream(@Req() req: Request, @Query('orderId') orderId?: string): Observable<MessageEvent> {
    const ctx = (req as any).branchContext;
    const branchId = ctx.branchId;

    return fromEvent<PaymentEvent>(this.eventEmitter, 'payment.update').pipe(
      filter((event) => {
        if (event.branchId !== branchId) return false;
        if (orderId && event.orderId !== orderId) return false;
        return true;
      }),
      map((event) => ({
        data: event,
        type: event.eventType,
      })),
    );
  }
}
