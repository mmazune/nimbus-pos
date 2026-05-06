import { Module } from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import { AccountsPayableController } from './accounts-payable.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [LedgerModule, Bg3ReliabilityModule],
  providers: [AccountsPayableService],
  controllers: [AccountsPayableController],
  exports: [AccountsPayableService],
})
export class AccountsPayableModule { }
