import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [OrdersModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
