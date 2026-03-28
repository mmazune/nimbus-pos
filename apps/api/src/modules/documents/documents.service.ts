import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  UploadDocumentDto,
  ListDocumentsQueryDto,
  LinkDocumentDto,
  UpdateStorageConfigDto,
  UpdateDocumentMetadataDto,
} from './dto';
import { DocumentStatus, StorageProviderType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_BASE = path.resolve(process.cwd(), 'uploads');

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Helpers ──

  private computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private buildStoragePath(orgId: string, fileName: string): string {
    return path.join(orgId, fileName);
  }

  // ── Upload ──

  async uploadDocument(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: UploadDocumentDto,
    file: Express.Multer.File,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const checksum = this.computeChecksum(file.buffer);
    const ext = path.extname(file.originalname) || '';

    // Dedupe check: same org + same checksum + ACTIVE
    const existing = await this.prisma.document.findFirst({
      where: {
        orgId: ctx.organizationId,
        checksum,
        status: DocumentStatus.ACTIVE,
      },
    });

    if (existing) {
      await this.audit.log({
        action: 'DOCUMENT_DEDUPE_HIT',
        actorUserId: userId,
        entityType: 'Document',
        entityId: existing.id,
        metadata: {
          checksum,
          originalFileName: file.originalname,
          ...auditMeta,
        },
      });
      return { document: existing, deduplicated: true };
    }

    // Generate unique file name
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const storagePath = this.buildStoragePath(ctx.organizationId, uniqueName);
    const fullPath = path.join(UPLOADS_BASE, storagePath);

    this.ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, file.buffer);

    const document = await this.prisma.document.create({
      data: {
        orgId: ctx.organizationId,
        branchId: dto.branchId || ctx.branchId,
        fileName: uniqueName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileExtension: ext || null,
        fileSizeBytes: file.size,
        checksum,
        storageProvider: StorageProviderType.LOCAL,
        storagePath,
        documentType: dto.documentType,
        uploadedById: userId,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
      include: { uploadedBy: { select: { id: true, email: true } } },
    });

    await this.audit.log({
      action: 'DOCUMENT_UPLOADED',
      actorUserId: userId,
      entityType: 'Document',
      entityId: document.id,
      metadata: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        checksum,
        documentType: dto.documentType,
        ...auditMeta,
      },
    });

    return { document, deduplicated: false };
  }

  // ── List ──

  async listDocuments(
    ctx: { branchId: string; organizationId: string },
    query: ListDocumentsQueryDto,
  ) {
    const where: Prisma.DocumentWhereInput = {
      orgId: ctx.organizationId,
      status: query.status || DocumentStatus.ACTIVE,
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.documentType) where.documentType = query.documentType;
    if (query.search) {
      where.originalFileName = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip ? Number(query.skip) : 0,
        take: query.take ? Number(query.take) : 25,
        include: {
          uploadedBy: { select: { id: true, email: true } },
          _count: { select: { links: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, skip: query.skip || 0, take: query.take || 25 };
  }

  // ── Get by ID ──

  async getDocument(id: string, ctx: { branchId: string; organizationId: string }) {
    const document = await this.prisma.document.findFirst({
      where: { id, orgId: ctx.organizationId, status: DocumentStatus.ACTIVE },
      include: {
        uploadedBy: { select: { id: true, email: true } },
        links: {
          include: { createdBy: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  // ── Download ──

  async downloadDocument(
    id: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id, orgId: ctx.organizationId, status: DocumentStatus.ACTIVE },
    });

    if (!document) {
      await this.audit.log({
        action: 'DOCUMENT_ACCESS_DENIED',
        actorUserId: userId,
        entityType: 'Document',
        entityId: id,
        metadata: { reason: 'not_found_or_deleted', ...auditMeta },
      });
      throw new NotFoundException('Document not found');
    }

    const fullPath = path.join(UPLOADS_BASE, document.storagePath);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('File not found on disk');
    }

    await this.audit.log({
      action: 'DOCUMENT_DOWNLOAD_ACCESSED',
      actorUserId: userId,
      entityType: 'Document',
      entityId: document.id,
      metadata: {
        fileName: document.originalFileName,
        ...auditMeta,
      },
    });

    return {
      filePath: fullPath,
      fileName: document.originalFileName,
      mimeType: document.mimeType,
    };
  }

  // ── Soft Delete ──

  async deleteDocument(
    id: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id, orgId: ctx.organizationId, status: DocumentStatus.ACTIVE },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.DELETED,
        deletedAt: new Date(),
        deletedById: userId,
      },
    });

    await this.audit.log({
      action: 'DOCUMENT_DELETED',
      actorUserId: userId,
      entityType: 'Document',
      entityId: document.id,
      metadata: {
        fileName: document.originalFileName,
        ...auditMeta,
      },
    });

    return updated;
  }

  // ── Link ──

  async linkDocument(
    documentId: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: LinkDocumentDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, orgId: ctx.organizationId, status: DocumentStatus.ACTIVE },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check for duplicate link
    const existingLink = await this.prisma.documentLink.findUnique({
      where: {
        documentId_linkType_linkedRecordId: {
          documentId,
          linkType: dto.linkType,
          linkedRecordId: dto.linkedRecordId,
        },
      },
    });

    if (existingLink) {
      throw new ConflictException('Document already linked to this record');
    }

    const link = await this.prisma.documentLink.create({
      data: {
        orgId: ctx.organizationId,
        branchId:
          dto.linkType === 'ORDER' || dto.linkType === 'RESERVATION' || dto.linkType === 'EVENT'
            ? ctx.branchId
            : document.branchId,
        documentId,
        linkType: dto.linkType,
        linkedRecordId: dto.linkedRecordId,
        linkedRecordLabel: dto.linkedRecordLabel || null,
        createdById: userId,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
      include: {
        document: { select: { id: true, originalFileName: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });

    await this.audit.log({
      action: 'DOCUMENT_LINKED',
      actorUserId: userId,
      entityType: 'DocumentLink',
      entityId: link.id,
      metadata: {
        documentId,
        linkType: dto.linkType,
        linkedRecordId: dto.linkedRecordId,
        ...auditMeta,
      },
    });

    return link;
  }

  // ── Get Links ──

  async getDocumentLinks(documentId: string, ctx: { branchId: string; organizationId: string }) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, orgId: ctx.organizationId, status: DocumentStatus.ACTIVE },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.prisma.documentLink.findMany({
      where: { documentId, orgId: ctx.organizationId },
      include: { createdBy: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Update Metadata ──

  async updateDocumentMetadata(
    id: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: UpdateDocumentMetadataDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id, orgId: ctx.organizationId, status: DocumentStatus.ACTIVE },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.DbNull },
    });

    await this.audit.log({
      action: 'DOCUMENT_METADATA_UPDATED',
      actorUserId: userId,
      entityType: 'Document',
      entityId: id,
      metadata: { ...auditMeta },
    });

    return updated;
  }

  // ── Storage Config ──

  async getStorageConfig(ctx: { organizationId: string }) {
    return this.prisma.storageProviderConfig.findMany({
      where: { orgId: ctx.organizationId },
      orderBy: { providerType: 'asc' },
    });
  }

  async updateStorageConfig(
    userId: string,
    ctx: { organizationId: string },
    providerType: StorageProviderType,
    dto: UpdateStorageConfigDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const config = await this.prisma.storageProviderConfig.upsert({
      where: {
        orgId_providerType: {
          orgId: ctx.organizationId,
          providerType,
        },
      },
      update: {
        enabled: dto.enabled,
        bucketOrContainer: dto.bucketOrContainer,
        basePath: dto.basePath,
        publicBaseUrl: dto.publicBaseUrl,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
      create: {
        orgId: ctx.organizationId,
        providerType,
        enabled: dto.enabled ?? true,
        bucketOrContainer: dto.bucketOrContainer || null,
        basePath: dto.basePath || null,
        publicBaseUrl: dto.publicBaseUrl || null,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    await this.audit.log({
      action: 'STORAGE_CONFIG_UPDATED',
      actorUserId: userId,
      entityType: 'StorageProviderConfig',
      entityId: config.id,
      metadata: { providerType, ...auditMeta },
    });

    return config;
  }
}
