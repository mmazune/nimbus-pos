import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { SeatingController } from './seating.controller';
import { SeatingService } from './seating.service';

@Module({
  imports: [OrdersModule],
  controllers: [SeatingController],
  providers: [SeatingService],
  exports: [SeatingService],
})
export class SeatingModule {}
