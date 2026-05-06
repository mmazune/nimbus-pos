import { Module } from '@nestjs/common';
import { AuditTimelineController } from './audit-timeline.controller';
import { AuditTimelineReadService } from './audit-timeline.service';

@Module({
    controllers: [AuditTimelineController],
    providers: [AuditTimelineReadService],
    exports: [AuditTimelineReadService],
})
export class AuditTimelineModule { }
