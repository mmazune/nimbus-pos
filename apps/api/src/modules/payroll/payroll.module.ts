import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [Bg3ReliabilityModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule { }
