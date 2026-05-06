import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { DigestService } from './digest.service';
import { OwnerLiveService } from './owner-live.service';
import { SourceSignalService } from './source-signal.service';

@Module({
    controllers: [AlertsController],
    providers: [
        AlertsService,
        ChannelDispatcherService,
        DigestService,
        OwnerLiveService,
        SourceSignalService,
    ],
    exports: [AlertsService, DigestService, OwnerLiveService, SourceSignalService],
})
export class AlertsModule { }
