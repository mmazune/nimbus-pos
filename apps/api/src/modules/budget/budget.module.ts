import { Module } from '@nestjs/common';
import {
  BudgetController,
  ForecastController,
  DemandCalendarController,
} from './budget.controller';
import { BudgetService } from './budget.service';
import { ForecastService } from './forecast.service';
import { DemandCalendarService } from './demand-calendar.service';

@Module({
  controllers: [BudgetController, ForecastController, DemandCalendarController],
  providers: [BudgetService, ForecastService, DemandCalendarService],
  exports: [BudgetService, ForecastService, DemandCalendarService],
})
export class BudgetModule {}
