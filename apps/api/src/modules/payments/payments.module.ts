import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MtnAdapter } from './adapters/mtn.adapter';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MtnAdapter],
  exports: [PaymentsService],
})
export class PaymentsModule { }
