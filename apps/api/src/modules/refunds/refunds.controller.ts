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
import { RefundsService } from './refunds.service';
import { CreateRefundDto, ApproveRefundDto, PostCloseVoidDto } from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post('orders/:id/refunds')
  @Permissions('pos:refund:create')
  async createRefund(
    @Param('id') orderId: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.refundsService.createRefund(user.id, ctx, orderId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refunds/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:refund:approve')
  async approveRefund(
    @Param('id') refundId: string,
    @Body() dto: ApproveRefundDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.refundsService.approveRefund(user.id, ctx, refundId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('refunds/:id')
  @Permissions('pos:refund:read')
  async getRefund(@Param('id') refundId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.refundsService.getRefund(ctx, refundId);
  }

  @Get('orders/:id/refunds')
  @Permissions('pos:refund:read')
  async listOrderRefunds(@Param('id') orderId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.refundsService.listOrderRefunds(ctx, orderId);
  }

  @Post('orders/:id/post-close-void')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:void:postclose')
  async postCloseVoid(
    @Param('id') orderId: string,
    @Body() dto: PostCloseVoidDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.refundsService.postCloseVoid(user.id, ctx, orderId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
