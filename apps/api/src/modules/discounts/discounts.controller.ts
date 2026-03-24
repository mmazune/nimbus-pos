import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { DiscountsService } from './discounts.service';
import {
  RequestDiscountDto,
  ApproveDiscountDto,
  RejectDiscountDto,
  ListOrderDiscountsQueryDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post('orders/:id/discounts')
  @Permissions('pos:discount:request')
  async requestDiscount(
    @Param('id') orderId: string,
    @Body() dto: RequestDiscountDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.discountsService.requestDiscount(user.id, ctx, orderId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('orders/:id/discounts')
  @Permissions('pos:discount:read')
  async listOrderDiscounts(
    @Param('id') orderId: string,
    @Query() query: ListOrderDiscountsQueryDto,
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.discountsService.listOrderDiscounts(ctx, orderId, query);
  }

  @Post('discounts/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:discount:approve')
  async approveDiscount(
    @Param('id') discountId: string,
    @Body() dto: ApproveDiscountDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.discountsService.approveDiscount(user.id, ctx, discountId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('discounts/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:discount:approve')
  async rejectDiscount(
    @Param('id') discountId: string,
    @Body() dto: RejectDiscountDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.discountsService.rejectDiscount(user.id, ctx, discountId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('discounts/pending')
  @Permissions('pos:discount:approve')
  async listPendingDiscounts(@Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.discountsService.listPendingDiscounts(ctx);
  }

  @Get('discounts/:id')
  @Permissions('pos:discount:read')
  async getDiscount(@Param('id') discountId: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.discountsService.getDiscount(ctx, discountId);
  }
}
