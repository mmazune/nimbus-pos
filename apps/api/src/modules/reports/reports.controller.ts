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
} from './dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ── Shift-End Report ──

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

  // ── Daily Sales Report ──

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

  // ── Payment Mix Report ──

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

  // ── Top Items Report ──

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

  // ── Stock Variance Report ──

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

  // ── Anomaly Summary Report ──

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

  // ── List Reports ──

  @Get()
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:history:read')
  @RequireBranchContext()
  async listReports(@Req() req: Request, @Query() query: ListReportsQueryDto) {
    const ctx = (req as any).branchContext;
    return this.reports.listReports(ctx.organizationId, ctx.branchId, query);
  }

  // ── Get Report By ID ──

  @Get(':id')
  @UseGuards(PermissionGuard, BranchContextGuard)
  @Permissions('pos:reports:history:read')
  @RequireBranchContext()
  async getReportById(@Req() req: Request, @Param('id') id: string) {
    const ctx = (req as any).branchContext;
    return this.reports.getReportById(ctx.organizationId, id);
  }

  // ── Create Export ──

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

  // ── Download Export ──

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
