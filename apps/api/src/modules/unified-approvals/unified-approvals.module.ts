import { Module } from '@nestjs/common';
import { UnifiedApprovalsController } from './unified-approvals.controller';
import { UnifiedApprovalsService } from './unified-approvals.service';
import { ApprovalRoutingService } from './approval-routing.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { RefundsModule } from '../refunds/refunds.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AccountsPayableModule } from '../accounts-payable/accounts-payable.module';
import { FranchiseModule } from '../franchise/franchise.module';

@Module({
    imports: [
        DiscountsModule,
        RefundsModule,
        AttendanceModule,
        AccountsPayableModule,
        FranchiseModule,
    ],
    controllers: [UnifiedApprovalsController],
    providers: [UnifiedApprovalsService, ApprovalRoutingService],
    exports: [UnifiedApprovalsService],
})
export class UnifiedApprovalsModule { }
