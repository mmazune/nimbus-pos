import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { ReportType, ReportWindow, ReportRunStatus, ExportFormat, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ReportsService {
  private readonly exportDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    // Local storage directory for v1 export artifacts
    this.exportDir = path.resolve(process.cwd(), 'exports');
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  // ── Date Range Helpers ──

  private resolveRange(
    reportWindow: ReportWindow,
    dateFrom?: string | null,
    dateTo?: string | null,
  ): { start: Date; end: Date } {
    if (reportWindow === 'CUSTOM') {
      if (!dateFrom || !dateTo) {
        throw new BadRequestException('dateFrom and dateTo required for CUSTOM window');
      }
      return { start: new Date(dateFrom), end: new Date(dateTo) };
    }
    const now = new Date();
    if (reportWindow === 'DAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { start, end };
    }
    if (reportWindow === 'WEEK') {
      const dayOfWeek = now.getDay();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    // MONTH
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }

  // ── Shift-End Report ──

  async generateShiftEndReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType: 'SHIFT_END',
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: parameters ?? Prisma.JsonNull,
      },
    });

    try {
      // Gather shift/till data
      const shifts = await this.prisma.shift.findMany({
        where: { orgId, branchId, createdAt: { gte: range.start, lt: range.end } },
        include: { tillSessions: { include: { cashMovements: true } } },
      });

      // Sales aggregation
      const salesAgg = await this.prisma.order.aggregate({
        where: {
          orgId,
          branchId,
          status: { in: ['CLOSED', 'SERVED'] },
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { subtotal: true, total: true, tax: true, discount: true },
        _count: true,
      });

      // Payment breakdown
      const payments = await this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          orgId,
          branchId,
          status: 'COMPLETED',
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
      });

      // Refunds
      const refundAgg = await this.prisma.refund.aggregate({
        where: {
          orgId,
          branchId,
          status: 'COMPLETED',
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
        _count: true,
      });

      const paymentBreakdown: Record<string, string> = {};
      for (const p of payments) {
        paymentBreakdown[p.method] = (p._sum.amount ?? new Prisma.Decimal(0)).toString();
      }

      // Cash movement summary
      let totalSafeDrops = new Prisma.Decimal(0);
      let tillCount = 0;
      for (const s of shifts) {
        for (const t of s.tillSessions) {
          tillCount++;
          for (const cm of t.cashMovements) {
            if (cm.type === 'SAFE_DROP') {
              totalSafeDrops = totalSafeDrops.add(cm.amount);
            }
          }
        }
      }

      const summary = {
        shiftCount: shifts.length,
        tillCount,
        grossSales: (salesAgg._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
        netSales: (salesAgg._sum.total ?? new Prisma.Decimal(0)).toString(),
        taxTotal: (salesAgg._sum.tax ?? new Prisma.Decimal(0)).toString(),
        discountTotal: (salesAgg._sum.discount ?? new Prisma.Decimal(0)).toString(),
        orderCount: salesAgg._count ?? 0,
        paymentBreakdown,
        refundTotal: (refundAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
        refundCount: refundAgg._count ?? 0,
        safeDropTotal: totalSafeDrops.toString(),
      };

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount: shifts.length + tillCount,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'SHIFT_END', reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'SHIFT_END', error: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Daily Sales Report ──

  async generateDailySalesReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType: 'DAILY_SALES',
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: parameters ?? Prisma.JsonNull,
      },
    });

    try {
      const salesAgg = await this.prisma.order.aggregate({
        where: {
          orgId,
          branchId,
          status: { in: ['CLOSED', 'SERVED'] },
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { subtotal: true, total: true, tax: true, discount: true },
        _count: true,
        _avg: { total: true },
      });

      const payments = await this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          orgId,
          branchId,
          status: 'COMPLETED',
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
      });

      const refundAgg = await this.prisma.refund.aggregate({
        where: {
          orgId,
          branchId,
          status: 'COMPLETED',
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
        _count: true,
      });

      const paymentBreakdown: Record<string, string> = {};
      for (const p of payments) {
        paymentBreakdown[p.method] = (p._sum.amount ?? new Prisma.Decimal(0)).toString();
      }

      const summary = {
        grossSales: (salesAgg._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
        netSales: (salesAgg._sum.total ?? new Prisma.Decimal(0)).toString(),
        taxTotal: (salesAgg._sum.tax ?? new Prisma.Decimal(0)).toString(),
        discountTotal: (salesAgg._sum.discount ?? new Prisma.Decimal(0)).toString(),
        orderCount: salesAgg._count ?? 0,
        avgOrderValue: (salesAgg._avg.total ?? new Prisma.Decimal(0)).toString(),
        paymentBreakdown,
        refundTotal: (refundAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
        refundCount: refundAgg._count ?? 0,
      };

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount: salesAgg._count ?? 0,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'DAILY_SALES', reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'DAILY_SALES', error: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Payment Mix Report ──

  async generatePaymentMixReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType: 'PAYMENT_MIX',
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: parameters ?? Prisma.JsonNull,
      },
    });

    try {
      const payments = await this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          orgId,
          branchId,
          status: 'COMPLETED',
          createdAt: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
        _count: true,
      });

      const totalAmount = payments.reduce(
        (acc, p) => acc.add(p._sum.amount ?? new Prisma.Decimal(0)),
        new Prisma.Decimal(0),
      );

      const breakdown = payments.map((p) => ({
        method: p.method,
        amount: (p._sum.amount ?? new Prisma.Decimal(0)).toString(),
        count: p._count ?? 0,
        percentage: totalAmount.gt(0)
          ? new Prisma.Decimal(p._sum.amount ?? 0).div(totalAmount).mul(100).toFixed(2)
          : '0.00',
      }));

      const summary = {
        totalAmount: totalAmount.toString(),
        breakdown,
      };

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount: payments.length,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'PAYMENT_MIX', reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'PAYMENT_MIX', error: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Top Items Report ──

  async generateTopItemsReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    limit = 20,
    parameters?: Record<string, any>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType: 'TOP_ITEMS',
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: { ...(parameters ?? {}), limit },
      },
    });

    try {
      const items = await this.prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          order: {
            orgId,
            branchId,
            status: { in: ['CLOSED', 'SERVED'] },
            createdAt: { gte: range.start, lt: range.end },
          },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit,
      });

      // Fetch item names
      const menuItemIds = items.map((i) => i.menuItemId);
      const menuItems = await this.prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(menuItems.map((m) => [m.id, m.name]));

      const topItems = items.map((i) => ({
        menuItemId: i.menuItemId,
        name: nameMap.get(i.menuItemId) ?? 'Unknown',
        quantitySold: i._sum.quantity ?? 0,
        grossSales: (i._sum.subtotal ?? new Prisma.Decimal(0)).toString(),
      }));

      const summary = { topItems, totalUniqueItems: items.length };

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount: items.length,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'TOP_ITEMS', reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'TOP_ITEMS', error: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Stock Variance Report ──

  async generateStockVarianceReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType: 'STOCK_VARIANCE',
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: parameters ?? Prisma.JsonNull,
      },
    });

    try {
      // Stock adjustments in period
      const adjustments = await this.prisma.stockAdjustment.findMany({
        where: {
          orgId,
          branchId,
          createdAt: { gte: range.start, lt: range.end },
        },
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      });

      const byItem = new Map<
        string,
        {
          name: string;
          unit: string;
          positive: Prisma.Decimal;
          negative: Prisma.Decimal;
          count: number;
        }
      >();
      for (const adj of adjustments) {
        const key = adj.itemId;
        const existing = byItem.get(key) ?? {
          name: adj.inventoryItem.name,
          unit: adj.inventoryItem.unit,
          positive: new Prisma.Decimal(0),
          negative: new Prisma.Decimal(0),
          count: 0,
        };
        existing.count++;
        if (adj.qtyDelta.gt(0)) {
          existing.positive = existing.positive.add(adj.qtyDelta);
        } else {
          existing.negative = existing.negative.add(adj.qtyDelta.abs());
        }
        byItem.set(key, existing);
      }

      const varianceItems = Array.from(byItem.entries()).map(([itemId, data]) => ({
        inventoryItemId: itemId,
        name: data.name,
        unit: data.unit,
        positiveAdjustments: data.positive.toString(),
        negativeAdjustments: data.negative.toString(),
        netChange: data.positive.sub(data.negative).toString(),
        adjustmentCount: data.count,
      }));

      const summary = {
        totalAdjustments: adjustments.length,
        itemsAffected: byItem.size,
        varianceItems,
      };

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount: adjustments.length,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'STOCK_VARIANCE', reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'STOCK_VARIANCE', error: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Anomaly Summary Report ──

  async generateAnomalySummaryReport(
    orgId: string,
    branchId: string,
    requestedById: string,
    reportWindow: ReportWindow,
    dateFrom?: string,
    dateTo?: string,
    parameters?: Record<string, any>,
  ) {
    const range = this.resolveRange(reportWindow, dateFrom, dateTo);

    const run = await this.prisma.reportRun.create({
      data: {
        orgId,
        branchId,
        reportType: 'ANOMALY_SUMMARY',
        reportWindow,
        requestedById,
        status: 'PENDING',
        dateFrom: range.start,
        dateTo: range.end,
        parameters: parameters ?? Prisma.JsonNull,
      },
    });

    try {
      const anomalies = await this.prisma.anomalyEvent.findMany({
        where: {
          orgId,
          branchId,
          createdAt: { gte: range.start, lt: range.end },
        },
      });

      const byStatus: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byType: Record<string, number> = {};

      for (const a of anomalies) {
        byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
        bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
        byType[a.type] = (byType[a.type] ?? 0) + 1;
      }

      const summary = {
        totalAnomalies: anomalies.length,
        byStatus,
        bySeverity,
        byType,
      };

      const updated = await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary,
          rowCount: anomalies.length,
          generatedAt: new Date(),
        },
      });

      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_COMPLETED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'ANOMALY_SUMMARY', reportWindow },
      });

      return updated;
    } catch (err) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      await this.audit.log({
        actorUserId: requestedById,
        action: 'REPORT_RUN_FAILED',
        entityType: 'ReportRun',
        entityId: run.id,
        metadata: { reportType: 'ANOMALY_SUMMARY', error: (err as Error).message },
      });
      throw err;
    }
  }

  // ── List Reports ──

  async listReports(
    orgId: string,
    branchId: string | null,
    query: {
      reportType?: ReportType;
      status?: ReportRunStatus;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { orgId };
    if (branchId) where.branchId = branchId;
    if (query.reportType) where.reportType = query.reportType;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.reportRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { exportArtifacts: true },
      }),
      this.prisma.reportRun.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  // ── Get Report By ID ──

  async getReportById(orgId: string, reportId: string) {
    const run = await this.prisma.reportRun.findFirst({
      where: { id: reportId, orgId },
      include: { exportArtifacts: true },
    });
    if (!run) throw new NotFoundException('Report run not found');
    return run;
  }

  // ── Export Artifact Creation ──

  async createExport(
    orgId: string,
    branchId: string | null,
    generatedById: string,
    reportRunId: string,
    format: ExportFormat,
  ) {
    const run = await this.prisma.reportRun.findFirst({
      where: { id: reportRunId, orgId },
    });
    if (!run) throw new NotFoundException('Report run not found');
    if (run.status !== 'COMPLETED') {
      throw new BadRequestException('Can only export completed reports');
    }

    const mimeType = format === 'CSV' ? 'text/csv' : 'application/pdf';
    const ext = format === 'CSV' ? 'csv' : 'pdf';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${run.reportType.toLowerCase()}_${timestamp}.${ext}`;
    const storagePath = path.join(this.exportDir, fileName);

    const artifact = await this.prisma.exportArtifact.create({
      data: {
        orgId,
        branchId: branchId ?? run.branchId,
        reportRunId,
        format,
        status: 'PENDING',
        fileName,
        mimeType,
        storagePath,
        generatedById,
      },
    });

    await this.audit.log({
      actorUserId: generatedById,
      action: 'EXPORT_ARTIFACT_CREATED',
      entityType: 'ExportArtifact',
      entityId: artifact.id,
      metadata: { reportRunId, format },
    });

    // Generate file synchronously for v1
    try {
      const content = this.generateExportContent(run, format);
      fs.writeFileSync(storagePath, content);
      const stats = fs.statSync(storagePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      const updated = await this.prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: {
          status: 'READY',
          readyAt: new Date(),
          fileSizeBytes: stats.size,
          checksum: hash,
        },
      });

      await this.audit.log({
        actorUserId: generatedById,
        action: 'EXPORT_ARTIFACT_READY',
        entityType: 'ExportArtifact',
        entityId: artifact.id,
        metadata: { fileName, fileSizeBytes: stats.size },
      });

      return updated;
    } catch (err) {
      await this.prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message },
      });
      throw err;
    }
  }

  // ── Export Content Generation ──

  private generateExportContent(run: any, format: ExportFormat): string {
    const summary = run.summary ?? {};

    if (format === 'CSV') {
      return this.generateCsv(run.reportType, summary);
    }
    // PDF: generate a simple text-based PDF-like content for v1
    // Real PDF library (pdfkit/puppeteer) would be added in a future iteration
    return this.generateTextPdf(run.reportType, summary, run);
  }

  private generateCsv(reportType: string, summary: any): string {
    const lines: string[] = [];

    switch (reportType) {
      case 'SHIFT_END':
        lines.push('Metric,Value');
        lines.push(`Shift Count,${summary.shiftCount ?? 0}`);
        lines.push(`Till Count,${summary.tillCount ?? 0}`);
        lines.push(`Gross Sales,${summary.grossSales ?? '0'}`);
        lines.push(`Net Sales,${summary.netSales ?? '0'}`);
        lines.push(`Tax Total,${summary.taxTotal ?? '0'}`);
        lines.push(`Discount Total,${summary.discountTotal ?? '0'}`);
        lines.push(`Order Count,${summary.orderCount ?? 0}`);
        lines.push(`Refund Total,${summary.refundTotal ?? '0'}`);
        lines.push(`Refund Count,${summary.refundCount ?? 0}`);
        lines.push(`Safe Drop Total,${summary.safeDropTotal ?? '0'}`);
        if (summary.paymentBreakdown) {
          for (const [method, amount] of Object.entries(summary.paymentBreakdown)) {
            lines.push(`Payment (${method}),${amount}`);
          }
        }
        break;

      case 'DAILY_SALES':
        lines.push('Metric,Value');
        lines.push(`Gross Sales,${summary.grossSales ?? '0'}`);
        lines.push(`Net Sales,${summary.netSales ?? '0'}`);
        lines.push(`Tax Total,${summary.taxTotal ?? '0'}`);
        lines.push(`Discount Total,${summary.discountTotal ?? '0'}`);
        lines.push(`Order Count,${summary.orderCount ?? 0}`);
        lines.push(`Avg Order Value,${summary.avgOrderValue ?? '0'}`);
        lines.push(`Refund Total,${summary.refundTotal ?? '0'}`);
        lines.push(`Refund Count,${summary.refundCount ?? 0}`);
        if (summary.paymentBreakdown) {
          for (const [method, amount] of Object.entries(summary.paymentBreakdown)) {
            lines.push(`Payment (${method}),${amount}`);
          }
        }
        break;

      case 'PAYMENT_MIX':
        lines.push('Method,Amount,Count,Percentage');
        if (summary.breakdown) {
          for (const row of summary.breakdown) {
            lines.push(`${row.method},${row.amount},${row.count},${row.percentage}%`);
          }
        }
        lines.push(`Total,${summary.totalAmount ?? '0'},,`);
        break;

      case 'TOP_ITEMS':
        lines.push('Rank,Item,Quantity Sold,Gross Sales');
        if (summary.topItems) {
          summary.topItems.forEach((item: any, idx: number) => {
            lines.push(`${idx + 1},${item.name},${item.quantitySold},${item.grossSales}`);
          });
        }
        break;

      case 'STOCK_VARIANCE':
        lines.push('Item,Unit,Positive Adjustments,Negative Adjustments,Net Change,Count');
        if (summary.varianceItems) {
          for (const item of summary.varianceItems) {
            lines.push(
              `${item.name},${item.unit},${item.positiveAdjustments},${item.negativeAdjustments},${item.netChange},${item.adjustmentCount}`,
            );
          }
        }
        break;

      case 'ANOMALY_SUMMARY':
        lines.push('Metric,Value');
        lines.push(`Total Anomalies,${summary.totalAnomalies ?? 0}`);
        if (summary.byStatus) {
          for (const [status, count] of Object.entries(summary.byStatus)) {
            lines.push(`Status: ${status},${count}`);
          }
        }
        if (summary.bySeverity) {
          for (const [severity, count] of Object.entries(summary.bySeverity)) {
            lines.push(`Severity: ${severity},${count}`);
          }
        }
        if (summary.byType) {
          for (const [type, count] of Object.entries(summary.byType)) {
            lines.push(`Type: ${type},${count}`);
          }
        }
        break;

      default:
        lines.push('Key,Value');
        for (const [key, val] of Object.entries(summary)) {
          lines.push(`${key},${typeof val === 'object' ? JSON.stringify(val) : val}`);
        }
    }

    return lines.join('\n');
  }

  private generateTextPdf(reportType: string, summary: any, run: any): string {
    // V1: Generates a structured text document. A proper PDF library (pdfkit/puppeteer)
    // would be integrated in a future milestone for production-grade PDF output.
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push(`NIMBUS POS — ${reportType.replace(/_/g, ' ')} REPORT`);
    lines.push('='.repeat(60));
    lines.push(`Report ID: ${run.id}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Period: ${run.dateFrom?.toISOString()} to ${run.dateTo?.toISOString()}`);
    lines.push(`Window: ${run.reportWindow}`);
    lines.push('-'.repeat(60));
    lines.push('');

    // Render summary in human-readable format
    for (const [key, val] of Object.entries(summary)) {
      if (typeof val === 'object' && val !== null) {
        lines.push(`${key}:`);
        if (Array.isArray(val)) {
          for (const item of val) {
            lines.push(`  - ${JSON.stringify(item)}`);
          }
        } else {
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            lines.push(`  ${k}: ${v}`);
          }
        }
      } else {
        lines.push(`${key}: ${val}`);
      }
    }

    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('This is an operational report, not a formal accounting statement.');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  // ── Get Export Artifact ──

  async getExportArtifact(orgId: string, artifactId: string) {
    const artifact = await this.prisma.exportArtifact.findFirst({
      where: { id: artifactId, orgId },
    });
    if (!artifact) throw new NotFoundException('Export artifact not found');
    return artifact;
  }

  // ── Download Export ──

  async getExportFilePath(
    orgId: string,
    artifactId: string,
  ): Promise<{
    path: string;
    fileName: string;
    mimeType: string;
  }> {
    const artifact = await this.prisma.exportArtifact.findFirst({
      where: { id: artifactId, orgId },
    });
    if (!artifact) throw new NotFoundException('Export artifact not found');
    if (artifact.status !== 'READY') {
      throw new BadRequestException('Export is not ready for download');
    }
    if (!fs.existsSync(artifact.storagePath)) {
      throw new NotFoundException('Export file not found on disk');
    }
    return {
      path: artifact.storagePath,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
    };
  }
}
