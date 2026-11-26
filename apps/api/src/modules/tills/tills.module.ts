import { Module } from '@nestjs/common';
import { TillsController } from './tills.controller';
import { TillsService } from './tills.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';
import { ApprovalRequestsModule } from '../approval-requests/approval-requests.module';

@Module({
  imports: [Bg3ReliabilityModule, ApprovalRequestsModule],
  controllers: [TillsController],
  providers: [TillsService],
  exports: [TillsService],
})
export class TillsModule {}
