import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PrepStation, StockCountKind, StoreKind } from '@prisma/client';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { StoresService } from './stores.service';

const AMOUNT = /^\d{1,9}(\.\d{1,3})?$/;
const MONEY = /^\d{1,10}(\.\d{1,6})?$/;

class Amount {
  @IsString()
  @Matches(AMOUNT)
  amount!: string;

  @IsString()
  @MaxLength(10)
  unit!: string;
}

export class CreateStoreDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsIn(['SECONDARY', 'POINT'])
  kind!: StoreKind;

  @IsOptional()
  @IsString()
  feedsFromStoreId?: string;
}

export class LinkStationDto {
  @IsString()
  storeId!: string;
}

export class SetLevelDto {
  @IsString()
  @Matches(AMOUNT)
  minimum!: string;

  @IsString()
  @Matches(AMOUNT)
  fillTo!: string;

  @IsString()
  @MaxLength(10)
  unit!: string;
}

class RequestLineDto extends Amount {
  @IsString()
  inventoryItemId!: string;
}

export class CreateRequestDto {
  @IsString()
  toStoreId!: string;

  @IsOptional()
  @IsBoolean()
  fromSuggestion?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestLineDto)
  lines?: RequestLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

class LineAmountDto extends Amount {
  @IsString()
  lineId!: string;
}

export class IssueDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineAmountDto)
  lines?: LineAmountDto[];
}

export class ReceiveDto extends IssueDto {
  /** The receiver types their own PIN. */
  @IsString()
  @Matches(/^\d{4,12}$/)
  pin!: string;
}

export class PinDto {
  @IsString()
  @Matches(/^\d{4,12}$/)
  pin!: string;
}

export class NoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ManagerNoteDto {
  @IsString()
  @MaxLength(500)
  note!: string;
}

class PoLineDto extends RequestLineDto {
  /** Per display unit (piece, kg, L). */
  @IsString()
  @Matches(MONEY)
  expectedUnitCost!: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @MaxLength(120)
  supplierName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PoLineDto)
  lines!: PoLineDto[];
}

class DeliveryLineDto extends RequestLineDto {
  /** Per display unit (piece, kg, L), as on the supplier's note. */
  @IsString()
  @Matches(MONEY)
  unitCost!: string;
}

export class DeliveryDto {
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierName?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryLineDto)
  lines!: DeliveryLineDto[];
}

export class OpenCountDto {
  @IsString()
  storeId!: string;

  @IsIn(['SPOT', 'FULL', 'BAR_SHIFT'])
  kind!: StockCountKind;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inventoryItemIds?: string[];

  @IsOptional()
  @IsBoolean()
  blind?: boolean;
}

export class CountLineDto extends Amount {}

type Me = { id: string; permissions?: string[] };
const me = (u: Me) => ({ id: u.id, permissions: u.permissions ?? [] });
const ctx = (req: Request) => (req as any).branchContext;

/** T6 phase 5 — stores, requests, deliveries, To buy and counts (03 sections 2, 7–10). */
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('stores')
  @Permissions('pos:stock:read')
  list(@Req() req: Request) {
    return this.stores.listStores(ctx(req));
  }

  @Post('stores')
  @Permissions('pos:store:setup')
  create(@Body() dto: CreateStoreDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.createStore(ctx(req), me(u), dto);
  }

  @Put('stores/stations/:station')
  @Permissions('pos:store:setup')
  link(
    @Param('station') station: PrepStation,
    @Body() dto: LinkStationDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.linkStation(ctx(req), me(u), station, dto.storeId);
  }

  @Put('stores/:storeId/levels/:itemId')
  @Permissions('pos:store:levels:write')
  setLevel(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @Body() dto: SetLevelDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.setLevel(ctx(req), me(u), storeId, itemId, dto);
  }

  @Get('stores/:storeId/suggestion')
  @Permissions('pos:stock:read')
  suggestion(@Param('storeId') storeId: string, @Req() req: Request) {
    return this.stores.suggestion(ctx(req), storeId);
  }

  @Get('store-requests')
  @Permissions('pos:stock:read')
  requests(
    @Query('status') status: string,
    @Query('storeId') storeId: string,
    @Query('losses') losses: string,
    @Req() req: Request,
  ) {
    return this.stores.listRequests(ctx(req), { status, storeId, losses });
  }

  @Post('store-requests')
  @Permissions('pos:store:request')
  ask(@Body() dto: CreateRequestDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.createRequest(ctx(req), me(u), dto);
  }

  @Post('store-requests/:id/issue')
  @HttpCode(200)
  @Permissions('pos:store:issue')
  issue(@Param('id') id: string, @Body() dto: IssueDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.issue(ctx(req), me(u), id, dto);
  }

  @Post('store-requests/:id/decline')
  @HttpCode(200)
  @Permissions('pos:store:issue')
  decline(
    @Param('id') id: string,
    @Body() dto: NoteDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.decline(ctx(req), me(u), id, dto.note);
  }

  @Post('store-requests/:id/receive')
  @HttpCode(200)
  @Permissions('pos:store:request')
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.receive(ctx(req), me(u), id, dto);
  }

  @Post('store-requests/:id/not-arrived')
  @HttpCode(200)
  @Permissions('pos:store:request')
  notArrived(
    @Param('id') id: string,
    @Body() dto: PinDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.notArrived(ctx(req), me(u), id, dto.pin);
  }

  @Post('purchase-orders')
  @Permissions('pos:purchasing:write')
  purchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.createPurchaseOrder(ctx(req), me(u), dto);
  }

  @Post('deliveries')
  @Permissions('pos:delivery:receive')
  delivery(@Body() dto: DeliveryDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.receiveDelivery(ctx(req), me(u), dto);
  }

  @Get('to-buy')
  @Permissions('pos:purchasing:read')
  toBuy(@Req() req: Request) {
    return this.stores.toBuy(ctx(req));
  }

  @Get('cost-changes')
  @Permissions('pos:cost:read')
  costChanges(@Req() req: Request) {
    return this.stores.costChanges(ctx(req));
  }

  @Post('stock-counts')
  @Permissions('pos:stock:count')
  openCount(@Body() dto: OpenCountDto, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.openCount(ctx(req), me(u), dto);
  }

  @Get('stock-counts/:id')
  @Permissions('pos:stock:count')
  getCount(@Param('id') id: string, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.getCount(ctx(req), me(u), id);
  }

  @Put('stock-counts/:id/lines/:itemId')
  @Permissions('pos:stock:count')
  saveLine(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountLineDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.saveLine(ctx(req), me(u), id, itemId, dto);
  }

  @Post('stock-counts/:id/manager-note')
  @HttpCode(200)
  @Permissions('pos:stock:count')
  note(
    @Param('id') id: string,
    @Body() dto: ManagerNoteDto,
    @CurrentUser() u: Me,
    @Req() req: Request,
  ) {
    return this.stores.managerNote(ctx(req), me(u), id, dto.note);
  }

  @Post('stock-counts/:id/close')
  @HttpCode(200)
  @Permissions('pos:stock:count')
  close(@Param('id') id: string, @CurrentUser() u: Me, @Req() req: Request) {
    return this.stores.closeCount(ctx(req), me(u), id);
  }
}
