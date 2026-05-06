import { Module } from '@nestjs/common';
import { MerchantPaymentsController } from './merchant-payments.controller';
import { MerchantPaymentsService } from './merchant-payments.service';

@Module({
    controllers: [MerchantPaymentsController],
    providers: [MerchantPaymentsService],
    exports: [MerchantPaymentsService],
})
export class MerchantPaymentsModule {}
