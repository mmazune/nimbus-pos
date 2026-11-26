import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule],
  controllers: [StockController, StoresController],
  providers: [StockService, StoresService],
  exports: [StockService, StoresService],
})
export class StockModule {}
