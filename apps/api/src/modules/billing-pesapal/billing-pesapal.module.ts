import { Module } from '@nestjs/common';
import { BillingPesapalController } from './billing-pesapal.controller';
import { BillingPesapalService } from './billing-pesapal.service';

@Module({
    controllers: [BillingPesapalController],
    providers: [BillingPesapalService],
    exports: [BillingPesapalService],
})
export class BillingPesapalModule {}
