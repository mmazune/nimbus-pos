import { Module } from '@nestjs/common';
import { TillsController } from './tills.controller';
import { TillsService } from './tills.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [Bg3ReliabilityModule],
  controllers: [TillsController],
  providers: [TillsService],
  exports: [TillsService],
})
export class TillsModule { }
