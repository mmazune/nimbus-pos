import { Module } from '@nestjs/common';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { Bg3ReliabilityModule } from '../bg3-reliability';

@Module({
  imports: [LedgerModule, Bg3ReliabilityModule],
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
  exports: [AccountsReceivableService],
})
export class AccountsReceivableModule { }
