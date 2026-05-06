import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [Bg3ReliabilityModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule { }
