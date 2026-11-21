import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { QuickSaleService } from './quick-sale.service';
import { QuickSaleDto } from './dto';

/**
 * One call, one transaction, one payment, safe to replay (EV-5, EV-14). Cashier already
 * holds both permissions; Bartender holds neither. No BG3 wrap and no Idempotency-Key:
 * the client-made `clientSaleId` is the replay key.
 */
@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class QuickSaleController {
  constructor(private readonly quickSale: QuickSaleService) {}

  @Post('quick-sale')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write', 'pos:orders:close')
  async create(
    @Body() dto: QuickSaleDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as Request & { branchContext: { branchId: string; organizationId: string } })
      .branchContext;
    return this.quickSale.quickSale(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
