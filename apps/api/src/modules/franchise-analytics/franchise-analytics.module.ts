import { Module } from '@nestjs/common';
import { FranchiseAnalyticsController } from './franchise-analytics.controller';
import { FranchiseAnalyticsService } from './franchise-analytics.service';

@Module({
  controllers: [FranchiseAnalyticsController],
  providers: [FranchiseAnalyticsService],
  exports: [FranchiseAnalyticsService],
})
export class FranchiseAnalyticsModule { }
