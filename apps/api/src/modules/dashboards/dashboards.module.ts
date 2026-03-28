import { Module } from '@nestjs/common';
import { DashboardsController, StreamController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  controllers: [DashboardsController, StreamController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
