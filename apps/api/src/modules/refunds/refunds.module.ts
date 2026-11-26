import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';
import { ApprovalRequestsModule } from '../approval-requests/approval-requests.module';

@Module({
  imports: [Bg3ReliabilityModule, ApprovalRequestsModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
