import { Module } from '@nestjs/common';
import { StaffInsightsController } from './staff-insights.controller';
import { StaffInsightsService } from './staff-insights.service';

@Module({
  controllers: [StaffInsightsController],
  providers: [StaffInsightsService],
  exports: [StaffInsightsService],
})
export class StaffInsightsModule {}
