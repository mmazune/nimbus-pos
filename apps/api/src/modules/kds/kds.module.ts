import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { KdsController } from './kds.controller';
import { KdsService } from './kds.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [KdsController],
  providers: [KdsService],
  exports: [KdsService],
})
export class KdsModule {}
