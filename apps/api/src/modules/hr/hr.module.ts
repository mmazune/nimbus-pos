import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { FrontlineStaffOnboardingService } from './frontline-staff-onboarding.service';
import { FrontlineStaffQuickPinService } from './frontline-staff-quick-pin.service';
import { EmployeeCredentialResetService } from './employee-credential-reset.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HrController],
  providers: [
    HrService,
    FrontlineStaffOnboardingService,
    FrontlineStaffQuickPinService,
    EmployeeCredentialResetService,
  ],
  exports: [
    HrService,
    FrontlineStaffOnboardingService,
    FrontlineStaffQuickPinService,
    EmployeeCredentialResetService,
  ],
})
export class HrModule { }
