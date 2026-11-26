import { Module } from '@nestjs/common';
import { OrdersController, OrderItemVoidController } from './orders.controller';
import { OrdersService } from './orders.service';
import { KdsModule } from '../kds/kds.module';

@Module({
  imports: [KdsModule],
  controllers: [OrdersController, OrderItemVoidController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
