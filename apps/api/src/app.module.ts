import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma';
import { AuditModule } from './common/audit';
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FloorModule } from './modules/floor/floor.module';
import { MenuModule } from './modules/menu/menu.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KdsModule } from './modules/kds/kds.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { TillsModule } from './modules/tills/tills.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { EventsModule } from './modules/events/events.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HrModule } from './modules/hr/hr.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { StaffInsightsModule } from './modules/staff-insights/staff-insights.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AccountsPayableModule } from './modules/accounts-payable/accounts-payable.module';
import { AccountsReceivableModule } from './modules/accounts-receivable/accounts-receivable.module';
import { BankRecModule } from './modules/bank-rec/bank-rec.module';
import { BudgetModule } from './modules/budget/budget.module';
import { FranchiseModule } from './modules/franchise/franchise.module';
import { FranchiseAnalyticsModule } from './modules/franchise-analytics/franchise-analytics.module';
import { BillingModule } from './modules/billing/billing.module';
import { BillingPesapalModule } from './modules/billing-pesapal/billing-pesapal.module';
import { ClientOnboardingModule } from './modules/client-onboarding/client-onboarding.module';
import { MerchantPaymentsModule } from './modules/merchant-payments/merchant-payments.module';
import { PublicCommerceModule } from './modules/public-commerce/public-commerce.module';
import { PublicCommercePaymentsModule } from './modules/public-commerce-payments/public-commerce-payments.module';
import { OpsPortalModule } from './modules/ops-portal/ops-portal.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ReliabilityModule } from './modules/reliability/reliability.module';
import { ControlPlaneModule } from './modules/controlplane/controlplane.module';
import { Bg3ReliabilityModule } from './modules/bg3-reliability';
import { UnifiedApprovalsModule } from './modules/unified-approvals/unified-approvals.module';
import { AuditTimelineModule } from './modules/audit-timeline/audit-timeline.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { PosHandoffModule } from './modules/pos-handoff/pos-handoff.module';
import { DeviceRegistryModule } from './modules/device-registry/device-registry.module';
import { ExportsModule } from './modules/exports/exports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    TenancyModule,
    SettingsModule,
    FloorModule,
    MenuModule,
    RecipesModule,
    InventoryModule,
    OrdersModule,
    KdsModule,
    DiscountsModule,
    PaymentsModule,
    RefundsModule,
    ShiftsModule,
    TillsModule,
    ReservationsModule,
    EventsModule,
    AnalyticsModule,
    DashboardsModule,
    ReportsModule,
    FeedbackModule,
    DocumentsModule,
    HrModule,
    AttendanceModule,
    WorkforceModule,
    PayrollModule,
    StaffInsightsModule,
    AccountingModule,
    LedgerModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    BankRecModule,
    BudgetModule,
    FranchiseModule,
    FranchiseAnalyticsModule,
    BillingModule,
    BillingPesapalModule,
    ClientOnboardingModule,
    MerchantPaymentsModule,
    PublicCommerceModule,
    PublicCommercePaymentsModule,
    OpsPortalModule,
    AlertsModule,
    ReliabilityModule,
    ControlPlaneModule,
    Bg3ReliabilityModule,
    UnifiedApprovalsModule,
    AuditTimelineModule,
    ReceiptsModule,
    PosHandoffModule,
    DeviceRegistryModule,
    ExportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
