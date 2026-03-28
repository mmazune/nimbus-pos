import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs');

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: any;
  let audit: any;

  const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-receipt.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('test file content'),
    size: 17,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockDocument = {
    id: 'doc-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    fileName: 'uuid.pdf',
    originalFileName: 'test-receipt.pdf',
    mimeType: 'application/pdf',
    fileExtension: '.pdf',
    fileSizeBytes: 17,
    checksum: 'abc123',
    storageProvider: 'LOCAL',
    storagePath: 'org-1/uuid.pdf',
    documentType: 'RECEIPT',
    status: 'ACTIVE',
    uploadedById: 'user-1',
    uploadedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      documentLink: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      storageProviderConfig: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  // ── Upload ──

  describe('uploadDocument', () => {
    it('should upload a new document', async () => {
      prisma.document.findFirst.mockResolvedValue(null); // no dedupe
      prisma.document.create.mockResolvedValue({
        ...mockDocument,
        uploadedBy: { id: 'user-1', email: 'u@test.com' },
      });

      const result = await service.uploadDocument(
        'user-1',
        ctx,
        { documentType: 'RECEIPT' as any },
        mockFile,
        meta,
      );

      expect(result.deduplicated).toBe(false);
      expect(result.document).toBeDefined();
      expect(prisma.document.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_UPLOADED' }),
      );
    });

    it('should return existing document on dedupe hit', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);

      const result = await service.uploadDocument(
        'user-1',
        ctx,
        { documentType: 'RECEIPT' as any },
        mockFile,
        meta,
      );

      expect(result.deduplicated).toBe(true);
      expect(result.document.id).toBe('doc-1');
      expect(prisma.document.create).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_DEDUPE_HIT' }),
      );
    });

    it('should throw BadRequestException when no file', async () => {
      await expect(
        service.uploadDocument(
          'user-1',
          ctx,
          { documentType: 'RECEIPT' as any },
          null as any,
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── List ──

  describe('listDocuments', () => {
    it('should list documents with pagination', async () => {
      prisma.document.findMany.mockResolvedValue([mockDocument]);
      prisma.document.count.mockResolvedValue(1);

      const result = await service.listDocuments(ctx, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.document.findMany).toHaveBeenCalledTimes(1);
    });

    it('should filter by documentType', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.listDocuments(ctx, { documentType: 'INVOICE' as any });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ documentType: 'INVOICE' }),
        }),
      );
    });

    it('should search by file name', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.listDocuments(ctx, { search: 'receipt' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            originalFileName: { contains: 'receipt', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  // ── Get by ID ──

  describe('getDocument', () => {
    it('should return document with links', async () => {
      prisma.document.findFirst.mockResolvedValue({ ...mockDocument, links: [] });

      const result = await service.getDocument('doc-1', ctx);
      expect(result.id).toBe('doc-1');
    });

    it('should throw NotFoundException for missing document', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getDocument('doc-999', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Download ──

  describe('downloadDocument', () => {
    it('should return file info for download', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.downloadDocument('doc-1', 'user-1', ctx, meta);

      expect(result.fileName).toBe('test-receipt.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_DOWNLOAD_ACCESSED' }),
      );
    });

    it('should throw NotFoundException for missing document', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.downloadDocument('doc-999', 'user-1', ctx, meta)).rejects.toThrow(
        NotFoundException,
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_ACCESS_DENIED' }),
      );
    });

    it('should throw NotFoundException when file not on disk', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.downloadDocument('doc-1', 'user-1', ctx, meta)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Delete ──

  describe('deleteDocument', () => {
    it('should soft-delete a document', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue({ ...mockDocument, status: 'DELETED' });

      const result = await service.deleteDocument('doc-1', 'user-1', ctx, meta);

      expect(result.status).toBe('DELETED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_DELETED' }),
      );
    });

    it('should throw NotFoundException for missing document', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.deleteDocument('doc-999', 'user-1', ctx, meta)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Link ──

  describe('linkDocument', () => {
    it('should create a document link', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.documentLink.findUnique.mockResolvedValue(null);
      prisma.documentLink.create.mockResolvedValue({
        id: 'link-1',
        documentId: 'doc-1',
        linkType: 'ORDER',
        linkedRecordId: 'order-1',
        document: { id: 'doc-1', originalFileName: 'test.pdf' },
        createdBy: { id: 'user-1', email: 'u@test.com' },
      });

      const result = await service.linkDocument(
        'doc-1',
        'user-1',
        ctx,
        { linkType: 'ORDER' as any, linkedRecordId: 'order-1' },
        meta,
      );

      expect(result.id).toBe('link-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_LINKED' }),
      );
    });

    it('should throw ConflictException for duplicate link', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.documentLink.findUnique.mockResolvedValue({ id: 'link-1' });

      await expect(
        service.linkDocument(
          'doc-1',
          'user-1',
          ctx,
          { linkType: 'ORDER' as any, linkedRecordId: 'order-1' },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for missing document', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.linkDocument(
          'doc-999',
          'user-1',
          ctx,
          { linkType: 'ORDER' as any, linkedRecordId: 'order-1' },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Get Links ──

  describe('getDocumentLinks', () => {
    it('should return links for a document', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.documentLink.findMany.mockResolvedValue([
        { id: 'link-1', linkType: 'ORDER', linkedRecordId: 'order-1' },
      ]);

      const result = await service.getDocumentLinks('doc-1', ctx);
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException for missing document', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getDocumentLinks('doc-999', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Update Metadata ──

  describe('updateDocumentMetadata', () => {
    it('should update document metadata', async () => {
      prisma.document.findFirst.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue({ ...mockDocument, metadata: { tag: 'important' } });

      const result = await service.updateDocumentMetadata(
        'doc-1',
        'user-1',
        ctx,
        { metadata: { tag: 'important' } },
        meta,
      );

      expect(result.metadata).toEqual({ tag: 'important' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOCUMENT_METADATA_UPDATED' }),
      );
    });

    it('should throw NotFoundException for missing document', async () => {
      prisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDocumentMetadata('doc-999', 'user-1', ctx, { metadata: { x: 1 } }, meta),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Storage Config ──

  describe('getStorageConfig', () => {
    it('should return storage configs for org', async () => {
      prisma.storageProviderConfig.findMany.mockResolvedValue([
        { id: 'cfg-1', providerType: 'LOCAL', enabled: true },
      ]);

      const result = await service.getStorageConfig({ organizationId: 'org-1' });
      expect(result).toHaveLength(1);
    });
  });

  describe('updateStorageConfig', () => {
    it('should upsert storage config', async () => {
      prisma.storageProviderConfig.upsert.mockResolvedValue({
        id: 'cfg-1',
        orgId: 'org-1',
        providerType: 'LOCAL',
        enabled: true,
        basePath: '/uploads',
      });

      const result = await service.updateStorageConfig(
        'user-1',
        { organizationId: 'org-1' },
        'LOCAL' as any,
        { enabled: true, basePath: '/uploads' },
        meta,
      );

      expect(result.id).toBe('cfg-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STORAGE_CONFIG_UPDATED' }),
      );
    });
  });
});
