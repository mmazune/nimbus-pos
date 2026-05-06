import { Module } from '@nestjs/common';
import { PublicCommercePaymentsController } from './public-commerce-payments.controller';
import { PublicCommercePaymentsService } from './public-commerce-payments.service';

@Module({
    controllers: [PublicCommercePaymentsController],
    providers: [PublicCommercePaymentsService],
    exports: [PublicCommercePaymentsService],
})
export class PublicCommercePaymentsModule {}
