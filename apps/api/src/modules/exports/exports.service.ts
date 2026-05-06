import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { ReportsService } from '../reports/reports.service';
import { DocumentsService } from '../documents/documents.service';
import {
  CreateExportDto,
  ExportFacadeFormat,
  ExportFacadeStatus,
  ExportSourceDomain,
  ListExportsDto,
} from './dto';

/**
 * BG6 — unified export/download facade.
 *
 * Normalisation-only layer. The facade does NOT generate exports itself
 * — it delegates to the underlying domain services
 * (`ReportsService`, `DocumentsService`) and reshapes their persisted
 * artefacts into a single envelope so the frontend has one mental model
 * for "download center" / "export history".
 *
 * The unified `exportId` is encoded as `<domain>:<underlyingId>` so the
 * download endpoint can route without an extra schema column.
 */
@Injectable()
export class ExportsFacadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly documents: DocumentsService,
  ) {}

  static encodeId(domain: ExportSourceDomain | 'documents', id: string): string {
    return `${domain}:${id}`;
  }

  static decodeId(id: string): { domain: 'reports' | 'documents'; underlyingId: string } {
    const idx = id.indexOf(':');
    if (idx <= 0 || idx === id.length - 1) {
      throw new BadRequestException(
        'Export id must be in the form "<domain>:<id>" (e.g. "reports:abc123")',
      );
    }
    const domain = id.slice(0, idx);
    const underlyingId = id.slice(idx + 1);
    if (domain !== 'reports' && domain !== 'documents') {
      throw new BadRequestException(`Unsupported export domain: ${domain}`);
    }
    return { domain, underlyingId };
  }

  // ── Status mapping ──

  private mapReportStatus(status: string): ExportFacadeStatus {
    switch (status) {
      case 'PENDING':
        return ExportFacadeStatus.QUEUED;
      case 'READY':
        return ExportFacadeStatus.COMPLETED;
      case 'FAILED':
        return ExportFacadeStatus.FAILED;
      default:
        return ExportFacadeStatus.QUEUED;
    }
  }

  // ── Envelopes ──

  private envelopeForReportArtifact(a: any) {
    return {
      exportId: ExportsFacadeService.encodeId(ExportSourceDomain.REPORTS, a.id),
      sourceDomain: 'reports' as const,
      sourceType: a.reportRun?.reportType ?? null,
      sourceRefId: a.reportRunId,
      requestedBy: a.generatedById,
      requestedAt: a.createdAt,
      status: this.mapReportStatus(a.status),
      format: a.format as ExportFacadeFormat,
      fileName: a.fileName,
      contentType: a.mimeType,
      fileSizeBytes: a.fileSizeBytes,
      checksum: a.checksum,
      readyAt: a.readyAt,
      failedAt: a.failedAt,
      failureReason: a.failureReason,
      // Async semantic — generation is synchronous in current Reports
      // service so READY is normally true immediately after POST. The
      // contract still supports async (QUEUED/RUNNING) honestly so the
      // frontend never has to guess.
      downloadReady: a.status === 'READY',
      downloadUrl: `/api/exports/${ExportsFacadeService.encodeId(
        ExportSourceDomain.REPORTS,
        a.id,
      )}/download`,
      retentionExpiresAt: null,
    };
  }

  private envelopeForDocument(d: any) {
    const ext = (d.originalFileName?.split('.').pop() ?? '').toUpperCase();
    return {
      exportId: ExportsFacadeService.encodeId('documents', d.id),
      sourceDomain: 'documents' as const,
      sourceType: d.documentType ?? 'DOCUMENT',
      sourceRefId: d.id,
      requestedBy: d.uploadedById,
      requestedAt: d.createdAt,
      status: ExportFacadeStatus.COMPLETED,
      format: ext || 'BINARY',
      fileName: d.originalFileName,
      contentType: d.mimeType,
      fileSizeBytes: d.fileSize ?? null,
      checksum: d.checksum ?? null,
      readyAt: d.createdAt,
      failedAt: null,
      failureReason: null,
      downloadReady: true,
      downloadUrl: `/api/exports/${ExportsFacadeService.encodeId(
        'documents',
        d.id,
      )}/download`,
      retentionExpiresAt: null,
    };
  }

  // ── POST /api/exports ──

  async createExport(params: {
    orgId: string;
    branchId: string | null;
    userId: string;
    dto: CreateExportDto;
  }) {
    const { orgId, branchId, userId, dto } = params;

    if (dto.sourceDomain !== ExportSourceDomain.REPORTS) {
      throw new BadRequestException(
        `sourceDomain "${dto.sourceDomain}" does not support facade-created exports yet — list/download only`,
      );
    }
    if (!dto.reportRunId) {
      throw new BadRequestException('reportRunId is required when sourceDomain=reports');
    }
    if (!dto.format) {
      throw new BadRequestException('format is required when sourceDomain=reports');
    }

    const artifact = await this.reports.createExport(
      orgId,
      branchId,
      userId,
      dto.reportRunId,
      dto.format as any,
    );
    // Reports service does not include reportRun in its return shape; fetch
    // sourceType cheaply for the envelope.
    const run = await this.prisma.reportRun.findFirst({
      where: { id: dto.reportRunId, orgId },
      select: { reportType: true },
    });
    return {
      ok: true,
      action: 'EXPORT_REQUESTED',
      export: this.envelopeForReportArtifact({ ...artifact, reportRun: run }),
    };
  }

  // ── GET /api/exports ──

  async listExports(params: {
    orgId: string;
    branchId: string | null;
    query: ListExportsDto;
  }) {
    const { orgId, branchId, query } = params;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const includeReports =
      !query.sourceDomain || query.sourceDomain === ExportSourceDomain.REPORTS;
    // Documents are listable but never user-selectable via the
    // sourceDomain filter (which only enumerates POST-capable domains).
    const includeDocuments = !query.sourceDomain;

    const reportArtifacts = includeReports
      ? await this.prisma.exportArtifact.findMany({
          where: {
            orgId,
            ...(branchId ? { branchId } : {}),
            ...(query.format ? { format: query.format as any } : {}),
            ...(query.requestedBy ? { generatedById: query.requestedBy } : {}),
            ...(query.status
              ? {
                  status:
                    query.status === ExportFacadeStatus.COMPLETED
                      ? ('READY' as any)
                      : query.status === ExportFacadeStatus.QUEUED
                        ? ('PENDING' as any)
                        : query.status === ExportFacadeStatus.FAILED
                          ? ('FAILED' as any)
                          : undefined,
                }
              : {}),
            ...(query.sourceType
              ? { reportRun: { reportType: query.sourceType as any } }
              : {}),
          },
          include: { reportRun: { select: { reportType: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      : [];

    const documents = includeDocuments
      ? await this.prisma.document.findMany({
          where: {
            orgId,
            ...(branchId ? { branchId } : {}),
            status: 'ACTIVE' as any,
            ...(query.requestedBy ? { uploadedById: query.requestedBy } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      : [];

    const merged = [
      ...reportArtifacts.map((a) => this.envelopeForReportArtifact(a)),
      ...documents.map((d) => this.envelopeForDocument(d)),
    ].sort(
      (a, b) =>
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );

    const total = merged.length;
    const start = (page - 1) * pageSize;
    const data = merged.slice(start, start + pageSize);

    return { data, total, page, pageSize };
  }

  // ── GET /api/exports/:id ──

  async getExport(params: { orgId: string; id: string }) {
    const { orgId, id } = params;
    const { domain, underlyingId } = ExportsFacadeService.decodeId(id);

    if (domain === 'reports') {
      const a = await this.prisma.exportArtifact.findFirst({
        where: { id: underlyingId, orgId },
        include: { reportRun: { select: { reportType: true } } },
      });
      if (!a) throw new NotFoundException('Export not found');
      return { export: this.envelopeForReportArtifact(a) };
    }

    const d = await this.prisma.document.findFirst({
      where: { id: underlyingId, orgId, status: 'ACTIVE' as any },
    });
    if (!d) throw new NotFoundException('Export not found');
    return { export: this.envelopeForDocument(d) };
  }

  // ── GET /api/exports/:id/download — resolution helper ──

  async resolveDownload(params: {
    orgId: string;
    branchId: string | null;
    userId: string;
    id: string;
    auditMeta?: { ipAddress?: string; userAgent?: string };
  }): Promise<{ filePath: string; fileName: string; contentType: string }> {
    const { orgId, branchId, userId, id, auditMeta } = params;
    const { domain, underlyingId } = ExportsFacadeService.decodeId(id);

    if (domain === 'reports') {
      const file = await this.reports.getExportFilePath(orgId, underlyingId);
      return {
        filePath: file.path,
        fileName: file.fileName,
        contentType: file.mimeType,
      };
    }

    const file = await this.documents.downloadDocument(
      underlyingId,
      userId,
      { branchId: branchId ?? '', organizationId: orgId },
      auditMeta,
    );
    return {
      filePath: file.filePath,
      fileName: file.fileName,
      contentType: file.mimeType,
    };
  }
}
