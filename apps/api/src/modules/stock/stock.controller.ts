import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { StockKind } from '@prisma/client';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { StockService, TAKE_OUT_REASONS, TakeOutReason } from './stock.service';

const AMOUNT = /^\d{1,9}(\.\d{1,3})?$/;

export class AmountDto {
  @IsString()
  inventoryItemId!: string;

  /** In the unit given: "1.5" with unit "kg" is 1,500 g. */
  @IsString()
  @Matches(AMOUNT)
  amount!: string;

  @IsString()
  @MaxLength(10)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class TakeOutDto extends AmountDto {
  @IsIn(Object.keys(TAKE_OUT_REASONS))
  reason!: TakeOutReason;

  /** A staff meal says who it was for. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  forWhom?: string;

  /** Above the venue's value limit a supervisor types their PIN on this device. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,12}$/)
  supervisorPin?: string;
}

export class ItemKindDto {
  @IsOptional()
  @IsIn(['COUNT', 'WEIGHT', 'VOLUME'])
  stockKind?: StockKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  packSize?: number;
}

export class ItemCostDto {
  /** Per display unit: per piece, per kg, per L. "18000" a kg is 18 a gram. */
  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,6})?$/)
  unitCost!: string;
}

export class RemakeDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class SoldAsDto {
  @IsIn(['AS_BOUGHT', 'MEASURE', 'RECIPE', 'NOT_TRACKED'])
  soldAs!: 'AS_BOUGHT' | 'MEASURE' | 'RECIPE' | 'NOT_TRACKED';

  @IsOptional()
  @IsString()
  stockItemId?: string;
}

export class ServingAmountDto {
  @IsString()
  @Matches(AMOUNT)
  amount!: string;

  @IsString()
  @MaxLength(10)
  unit!: string;
}

type Me = { id: string; permissions?: string[] };

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('stock/levels')
  @Permissions('pos:stock:read')
  levels(@CurrentUser() u: Me, @Req() req: Request) {
    return this.stock.levels((req as any).branchContext, { permissions: u.permissions ?? [] });
  }

  @Get('stock/movements')
  @Permissions('pos:stock:read')
  movements(
    @Query('inventoryItemId') inventoryItemId: string,
    @Query('orderItemId') orderItemId: string,
    @Query('type') type: string,
    @Query('take') take: string,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stock.movements(
      (req as any).branchContext,
      { permissions: u.permissions ?? [] },
      { inventoryItemId, orderItemId, type, take: take ? Number(take) : undefined },
    );
  }

  @Post('stock/take-out')
  @Permissions('pos:stock:take-out')
  takeOut(@Body() dto: TakeOutDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stock.takeOut(
      (req as any).branchContext,
      { id: u.id, permissions: u.permissions ?? [] },
      dto,
    );
  }

  @Post('stock/found')
  @Permissions('pos:stock:take-out')
  found(@Body() dto: AmountDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stock.found((req as any).branchContext, u.id, dto);
  }

  @Post('stock/opening')
  @Permissions('pos:inventory:write')
  opening(@Body() dto: AmountDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stock.opening((req as any).branchContext, u.id, dto);
  }

  @Patch('stock/items/:id')
  @Permissions('pos:inventory:write')
  setKind(
    @Param('id') id: string,
    @Body() dto: ItemKindDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stock.setItemKind((req as any).branchContext, u.id, id, dto);
  }

  @Put('stock/items/:id/cost')
  @Permissions('pos:cost:write')
  setCost(
    @Param('id') id: string,
    @Body() dto: ItemCostDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stock.setItemCost((req as any).branchContext, u.id, id, dto.unitCost);
  }

  @Patch('menu/items/:id/sold-as')
  @Permissions('pos:recipe:write')
  soldAs(
    @Param('id') id: string,
    @Body() dto: SoldAsDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stock.setSoldAs((req as any).branchContext, u.id, id, dto);
  }

  @Put('menu/servings/:id/stock-amount')
  @Permissions('pos:recipe:write')
  servingAmount(
    @Param('id') id: string,
    @Body() dto: ServingAmountDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stock.setServingAmount((req as any).branchContext, u.id, id, dto.amount, dto.unit);
  }

  @Post('pos/orders/:orderId/lines/:itemId/remake')
  @HttpCode(201)
  @Permissions('pos:stock:remake')
  remake(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RemakeDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stock.remake((req as any).branchContext, u.id, orderId, itemId, dto.note);
  }
}
