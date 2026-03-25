import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  AddOrderItemDto,
  UpdateOrderItemDto,
  TransitionOrderDto,
  ListOrdersQueryDto,
} from './dto';
import { JwtAuthGuard, PermissionGuard, BranchContextGuard } from '../../common/guards';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';

@Controller('pos/orders')
@UseGuards(JwtAuthGuard, PermissionGuard, BranchContextGuard)
@RequireBranchContext()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  @Permissions('pos:orders:write')
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.createOrder(user.id, ctx, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get()
  @Permissions('pos:orders:read')
  async listOrders(@Query() query: ListOrdersQueryDto, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ordersService.listOrders(ctx, query);
  }

  @Get(':id')
  @Permissions('pos:orders:read')
  async getOrder(@Param('id') id: string, @Req() req: Request) {
    const ctx = (req as any).branchContext;
    return this.ordersService.getOrder(ctx, id);
  }

  @Post(':id/items')
  @Permissions('pos:orders:write')
  async addOrderItem(
    @Param('id') id: string,
    @Body() dto: AddOrderItemDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.addOrderItem(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/items/:itemId')
  @Permissions('pos:orders:write')
  async updateOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.updateOrderItem(user.id, ctx, id, itemId, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id/items/:itemId')
  @Permissions('pos:orders:write')
  async deleteOrderItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.deleteOrderItem(user.id, ctx, id, itemId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  async sendOrder(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.sendOrder(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/in-kitchen')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  async markInKitchen(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.markInKitchen(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/ready')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  async markReady(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.markReady(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post(':id/mark-served')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:write')
  async markServed(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.markServed(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // M13: close-order endpoint moved to PaymentsController (POST /pos/orders/:id/close with payment body)

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @Permissions('pos:orders:void')
  async voidOrder(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ctx = (req as any).branchContext;
    return this.ordersService.voidOrder(user.id, ctx, id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
