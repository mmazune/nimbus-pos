import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MtnAdapter } from './adapters/mtn.adapter';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [Bg3ReliabilityModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MtnAdapter],
  exports: [PaymentsService],
})
export class PaymentsModule { }
