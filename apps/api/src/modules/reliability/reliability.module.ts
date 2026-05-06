import { Module } from '@nestjs/common';
import { ReliabilityController } from './reliability.controller';
import { SyncService } from './sync.service';
import { IdempotencyService } from './idempotency.service';
import { ReplayDispatcherService } from './replay-dispatcher.service';

@Module({
    controllers: [ReliabilityController],
    providers: [SyncService, IdempotencyService, ReplayDispatcherService],
    exports: [SyncService, IdempotencyService, ReplayDispatcherService],
})
export class ReliabilityModule { }
