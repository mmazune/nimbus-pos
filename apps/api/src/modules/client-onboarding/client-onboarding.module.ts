import { Module } from '@nestjs/common';
import { ClientOnboardingController } from './client-onboarding.controller';
import { ClientOnboardingService } from './client-onboarding.service';
import { BillingModule } from '../billing/billing.module';

@Module({
    imports: [BillingModule],
    controllers: [ClientOnboardingController],
    providers: [ClientOnboardingService],
    exports: [ClientOnboardingService],
})
export class ClientOnboardingModule { }
