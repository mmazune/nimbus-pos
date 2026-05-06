import { Module } from '@nestjs/common';
import { MerchantCommerceController, PublicCommerceController } from './public-commerce.controller';
import { PublicCommerceService } from './public-commerce.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
    imports: [Bg3ReliabilityModule],
    controllers: [MerchantCommerceController, PublicCommerceController],
    providers: [PublicCommerceService],
    exports: [PublicCommerceService],
})
export class PublicCommerceModule { }
