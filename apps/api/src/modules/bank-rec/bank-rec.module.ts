import { Module } from '@nestjs/common';
import { BankRecService } from './bank-rec.service';
import { BankRecController } from './bank-rec.controller';

@Module({
  controllers: [BankRecController],
  providers: [BankRecService],
  exports: [BankRecService],
})
export class BankRecModule {}
