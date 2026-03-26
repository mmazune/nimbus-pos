import { Module } from '@nestjs/common';
import { TillsController } from './tills.controller';
import { TillsService } from './tills.service';

@Module({
  controllers: [TillsController],
  providers: [TillsService],
  exports: [TillsService],
})
export class TillsModule {}
