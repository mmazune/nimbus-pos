import { Controller, Get, Post, Param, Query, Req, Res, UseGuards, Body } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { BranchContextGuard } from '../../common/guards/branch-context.guard';
import { CurrentUser, Permissions, RequireBranchContext } from '../../common/decorators';
import { ReportsService } from './reports.service';
import {
  CreateShiftEndReportDto,
  CreateDailySalesReportDto,
  CreatePaymentMixReportDto,
  CreateTopItemsReportDto,
  CreateStockVarianceReportDto,
  CreateAnomalySummaryReportDto,
  CreateExportDto,
  ListReportsQueryDto,
  CreateSalesByCategoryReportDto,
  CreateSalesByHourReportDto,
  CreateDiscountsReportDto,
  CreateVoidsReportDto,
  CreateRefundsReportDto,
  CreateCashVarianceReportDto,
  CreateCashMovementsReportDto,
  CreateWastageReportDto,
  CreateLowStockReportDto,
  CreateReservationSummaryReportDto,
  CreateEventSummaryReportDto,
  CreateStaffOperationsReportDto,
} from './dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ═══════════════════════════════════════════
  //  CATALOG (must be above parameterised routes)
  // ═══════════════════════════════════════════

  @Get('catalog')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:catalog:read')
  @RequireBranchContext()
  getReportCatalog() {
    return this.reports.getReportCatalog();
  }

  // ═══════════════════════════════════════════
  //  A) CORE SALES / REVENUE
  // ═══════════════════════════════════════════

  @Post('shift-end')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:shift-end:generate')
  @RequireBranchContext()
  async generateShiftEndReport(
    @Req() req: Request,
    @Body() dto: CreateShiftEndReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateShiftEndReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('daily-sales')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:daily-sales:generate')
  @RequireBranchContext()
  async generateDailySalesReport(
    @Req() req: Request,
    @Body() dto: CreateDailySalesReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateDailySalesReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('payment-mix')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:payment-mix:generate')
  @RequireBranchContext()
  async generatePaymentMixReport(
    @Req() req: Request,
    @Body() dto: CreatePaymentMixReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generatePaymentMixReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('top-items')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:top-items:generate')
  @RequireBranchContext()
  async generateTopItemsReport(
    @Req() req: Request,
    @Body() dto: CreateTopItemsReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateTopItemsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.limit,
      dto.parameters,
    );
  }

  @Post('sales-by-category')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:sales-by-category:generate')
  @RequireBranchContext()
  async generateSalesByCategoryReport(
    @Req() req: Request,
    @Body() dto: CreateSalesByCategoryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateSalesByCategoryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('sales-by-hour')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:sales-by-hour:generate')
  @RequireBranchContext()
  async generateSalesByHourReport(
    @Req() req: Request,
    @Body() dto: CreateSalesByHourReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateSalesByHourReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('open-closed-orders')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:daily-sales:generate')
  @RequireBranchContext()
  async generateOpenClosedOrdersReport(
    @Req() req: Request,
    @Body() dto: CreateDailySalesReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateOpenClosedOrdersReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  B) DISCOUNT / VOID / REFUND
  // ═══════════════════════════════════════════

  @Post('discounts-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:discounts:generate')
  @RequireBranchContext()
  async generateDiscountsSummary(
    @Req() req: Request,
    @Body() dto: CreateDiscountsReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateDiscountsSummaryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('voids-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:voids:generate')
  @RequireBranchContext()
  async generateVoidsSummary(
    @Req() req: Request,
    @Body() dto: CreateVoidsReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateVoidsSummaryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('refunds-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:refunds:generate')
  @RequireBranchContext()
  async generateRefundsSummary(
    @Req() req: Request,
    @Body() dto: CreateRefundsReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateRefundsSummaryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  C) CASH / TILL / SHIFT CONTROL
  // ═══════════════════════════════════════════

  @Post('cash-variance')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:cash-variance:generate')
  @RequireBranchContext()
  async generateCashVarianceReport(
    @Req() req: Request,
    @Body() dto: CreateCashVarianceReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateCashVarianceReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('cash-movements')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:cash-movements:generate')
  @RequireBranchContext()
  async generateCashMovementsReport(
    @Req() req: Request,
    @Body() dto: CreateCashMovementsReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateCashMovementsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  D) INVENTORY / STOCK CONTROL
  // ═══════════════════════════════════════════

  @Post('stock-variance')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:stock-variance:generate')
  @RequireBranchContext()
  async generateStockVarianceReport(
    @Req() req: Request,
    @Body() dto: CreateStockVarianceReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateStockVarianceReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('wastage-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:wastage:generate')
  @RequireBranchContext()
  async generateWastageReport(
    @Req() req: Request,
    @Body() dto: CreateWastageReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateWastageReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('low-stock')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:low-stock:generate')
  @RequireBranchContext()
  async generateLowStockReport(
    @Req() req: Request,
    @Body() dto: CreateLowStockReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateLowStockReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  E) RESERVATION / DEPOSIT
  // ═══════════════════════════════════════════

  @Post('reservation-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:reservations:generate')
  @RequireBranchContext()
  async generateReservationSummaryReport(
    @Req() req: Request,
    @Body() dto: CreateReservationSummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateReservationSummaryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('reservation-deposits')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:reservations:generate')
  @RequireBranchContext()
  async generateReservationDepositsReport(
    @Req() req: Request,
    @Body() dto: CreateReservationSummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateReservationDepositsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('reservation-no-shows')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:reservations:generate')
  @RequireBranchContext()
  async generateReservationNoShowsReport(
    @Req() req: Request,
    @Body() dto: CreateReservationSummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateReservationNoShowsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  F) EVENT / TICKETING
  // ═══════════════════════════════════════════

  @Post('event-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:events:generate')
  @RequireBranchContext()
  async generateEventSummaryReport(
    @Req() req: Request,
    @Body() dto: CreateEventSummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateEventSummaryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('event-bookings')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:events:generate')
  @RequireBranchContext()
  async generateEventBookingsReport(
    @Req() req: Request,
    @Body() dto: CreateEventSummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateEventBookingsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('event-checkins')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:events:generate')
  @RequireBranchContext()
  async generateEventCheckinsReport(
    @Req() req: Request,
    @Body() dto: CreateEventSummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateEventCheckinsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  G) RISK / ANOMALY
  // ═══════════════════════════════════════════

  @Post('anomaly-summary')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:anomaly-summary:generate')
  @RequireBranchContext()
  async generateAnomalySummaryReport(
    @Req() req: Request,
    @Body() dto: CreateAnomalySummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateAnomalySummaryReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  @Post('high-risk-actors')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:anomaly-summary:generate')
  @RequireBranchContext()
  async generateHighRiskActorsReport(
    @Req() req: Request,
    @Body() dto: CreateAnomalySummaryReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateHighRiskActorsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  H) STAFF OPERATIONS
  // ═══════════════════════════════════════════

  @Post('staff-operations')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:staff-operations:generate')
  @RequireBranchContext()
  async generateStaffOperationsReport(
    @Req() req: Request,
    @Body() dto: CreateStaffOperationsReportDto,
    @CurrentUser() user: any,
  ) {
    const ctx = (req as any).branchContext;
    return this.reports.generateStaffOperationsReport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportWindow,
      dto.dateFrom,
      dto.dateTo,
      dto.parameters,
    );
  }

  // ═══════════════════════════════════════════
  //  LIST / HISTORY / EXPORT
  // ═══════════════════════════════════════════

  @Get()
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:history:read')
  @RequireBranchContext()
  async listReports(@Req() req: Request, @Query() query: ListReportsQueryDto) {
    const ctx = (req as any).branchContext;
    return this.reports.listReports(ctx.organizationId, ctx.branchId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:history:read')
  @RequireBranchContext()
  async getReportById(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).branchContext;
    return this.reports.getReportById(ctx.organizationId, id);
  }

  @Post('export')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:exports:read')
  @RequireBranchContext()
  async createExport(@Req() req: Request, @Body() dto: CreateExportDto, @CurrentUser() user: any) {
    const ctx = (req as any).branchContext;
    return this.reports.createExport(
      ctx.organizationId,
      ctx.branchId,
      user.id,
      dto.reportRunId,
      dto.format,
    );
  }

  @Get('exports/:id/download')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:exports:download')
  @RequireBranchContext()
  async downloadExport(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const ctx = (req as any).branchContext;
    const file = await this.reports.getExportFilePath(ctx.organizationId, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.sendFile(file.path);
  }
}
