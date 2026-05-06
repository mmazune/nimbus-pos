import { Module } from '@nestjs/common';
import { OpsPortalController } from './ops-portal.controller';
import { OpsPortalService } from './ops-portal.service';

@Module({
    controllers: [OpsPortalController],
    providers: [OpsPortalService],
    exports: [OpsPortalService],
})
export class OpsPortalModule {}
