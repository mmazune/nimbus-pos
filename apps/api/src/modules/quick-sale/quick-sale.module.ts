import { Module } from '@nestjs/common';
import { QuickSaleController } from './quick-sale.controller';
import { QuickSaleService } from './quick-sale.service';

@Module({
  controllers: [QuickSaleController],
  providers: [QuickSaleService],
})
export class QuickSaleModule {}
