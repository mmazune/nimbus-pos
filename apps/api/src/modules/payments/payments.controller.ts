import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CloseOrderDto, CreatePaymentIntentDto, CancelPaymentIntentDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { AuditService } from '../../common/audit';

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  // ── Close Order with Payment (extends POST /pos/orders/:id/close) ──
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

  // ── Cancel Payment Intent ──
  @Post('payments/intents/:intentId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
  @RequireBranchContext()
  @Permissions('pos:payment:intent')
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

  // ── MTN Webhook (unauthenticated callback) ──
  @Post('webhooks/mtn')
  @HttpCode(HttpStatus.OK)
  async mtnWebhook(@Body() payload: Record<string, unknown>) {
    return this.paymentsService.processWebhook('MTN', payload);
  }

  // ── Airtel Webhook (unauthenticated callback) ──
  @Post('webhooks/airtel')
  @HttpCode(HttpStatus.OK)
  async airtelWebhook(@Body() payload: Record<string, unknown>) {
    return this.paymentsService.processWebhook('AIRTEL', payload);
  }
}
