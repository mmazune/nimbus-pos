import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { KdsModule } from '../kds/kds.module';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [KdsModule, ReservationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
