import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma';

/**
 * M22 Documents + Uploads + Attachments e2e tests.
 * Requires seeded DB with M22 permissions.
 */
describe('Documents + Uploads + Attachments (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let ownerToken: string;
  let chefToken: string;
  let branchId: string;
  let documentId: string;
  let _linkId: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Clean up any non-seeded documents left from previous runs
    const prisma = moduleFixture.get(PrismaService);
    const seededChecksums = [
      'sha256-seed-receipt-001',
      'sha256-seed-invoice-001',
      'sha256-seed-contract-001',
    ];
    const stale = await prisma.document.findMany({
      where: { checksum: { notIn: seededChecksums } },
      select: { id: true },
    });
    if (stale.length > 0) {
      const staleIds = stale.map((d) => d.id);
      await prisma.documentLink.deleteMany({ where: { documentId: { in: staleIds } } });
      await prisma.document.deleteMany({ where: { id: { in: staleIds } } });
    }

    // Login as owner (has all permissions)
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'owner@demo.local', password: 'Owner#123' });
    ownerToken = ownerLogin.body.accessToken;

    // Login as chef (limited permissions)
    const chefLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'chef@demo.local', password: 'Chef#123' });
    chefToken = chefLogin.body.accessToken;

    // Get branch ID
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    branchId =
      me.body.defaultBranch?.id ||
      me.body.organizations?.[0]?.branches?.[0]?.id ||
      me.body.branches?.[0]?.id ||
      me.body.memberships?.[0]?.branchId;
  }, 30000);

  afterAll(async () => {
    const prisma = moduleFixture.get(PrismaService);
    // Cleanup test document links first
    if (documentId) {
      await prisma.documentLink.deleteMany({ where: { documentId } });
      await prisma.document.deleteMany({ where: { id: documentId } });
    }
    await app.close();
  }, 30000);

  // ── Upload ──

  describe('POST /documents/upload', () => {
    it('should upload a document', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .field('documentType', 'RECEIPT')
        .attach('file', Buffer.from('e2e test file content'), {
          filename: 'e2e-test-receipt.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body).toHaveProperty('document');
      expect(res.body.document).toHaveProperty('id');
      expect(res.body.document.originalFileName).toBe('e2e-test-receipt.pdf');
      expect(res.body.document.documentType).toBe('RECEIPT');
      expect(res.body.deduplicated).toBe(false);
      documentId = res.body.document.id;
    });

    it('should return deduplicated result for same file', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .field('documentType', 'RECEIPT')
        .attach('file', Buffer.from('e2e test file content'), {
          filename: 'duplicate-receipt.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.deduplicated).toBe(true);
      expect(res.body.document.id).toBe(documentId);
    });

    it('should reject without file', async () => {
      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .field('documentType', 'RECEIPT')
        .expect(400);
    });

    it('should reject without branch header', async () => {
      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('documentType', 'RECEIPT')
        .attach('file', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    it('should reject unauthorized role (chef)', async () => {
      await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${chefToken}`)
        .set('X-Branch-Id', branchId)
        .field('documentType', 'RECEIPT')
        .attach('file', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);
    });
  });

  // ── List ──

  describe('GET /documents', () => {
    it('should list documents', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by documentType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents?documentType=RECEIPT')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.every((d: any) => d.documentType === 'RECEIPT')).toBe(true);
    });

    it('should search by filename', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents?search=e2e-test-receipt')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should paginate', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents?skip=0&take=1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  // ── Get by ID ──

  describe('GET /documents/:id', () => {
    it('should return document details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.id).toBe(documentId);
      expect(res.body).toHaveProperty('links');
      expect(res.body).toHaveProperty('uploadedBy');
    });

    it('should return 404 for unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/documents/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });

  // ── Download ──

  describe('GET /documents/:id/download', () => {
    it('should download a document', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/${documentId}/download`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('e2e-test-receipt.pdf');
    });

    it('should return 404 for unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/documents/nonexistent-id/download')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });

  // ── Link ──

  describe('POST /documents/:id/link', () => {
    it('should link a document to a record', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/documents/${documentId}/link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          linkType: 'ORDER',
          linkedRecordId: 'test-order-id',
          linkedRecordLabel: 'Order #E2E-001',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.linkType).toBe('ORDER');
      expect(res.body.linkedRecordId).toBe('test-order-id');
      _linkId = res.body.id;
    });

    it('should reject duplicate link', async () => {
      await request(app.getHttpServer())
        .post(`/api/documents/${documentId}/link`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          linkType: 'ORDER',
          linkedRecordId: 'test-order-id',
        })
        .expect(409);
    });

    it('should return 404 for unknown document', async () => {
      await request(app.getHttpServer())
        .post('/api/documents/nonexistent-id/link')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({
          linkType: 'ORDER',
          linkedRecordId: 'some-order',
        })
        .expect(404);
    });
  });

  // ── Get Links ──

  describe('GET /documents/:id/links', () => {
    it('should return links for a document', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/documents/${documentId}/links`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].linkType).toBe('ORDER');
    });
  });

  // ── Update Metadata ──

  describe('PATCH /documents/:id/metadata', () => {
    it('should update document metadata', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/documents/${documentId}/metadata`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ metadata: { tag: 'important', category: 'finance' } })
        .expect(200);

      expect(res.body.metadata).toEqual({ tag: 'important', category: 'finance' });
    });
  });

  // ── Storage Config ──

  describe('GET /documents/storage-config', () => {
    it('should return storage configs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/documents/storage-config')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PATCH /documents/storage-config/:providerType', () => {
    it('should update storage config', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/documents/storage-config/LOCAL')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .send({ enabled: true, basePath: '/uploads' })
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.providerType).toBe('LOCAL');
    });
  });

  // ── Delete (soft) ──

  describe('DELETE /documents/:id', () => {
    it('should soft-delete a document', async () => {
      // First upload a separate document to delete
      const uploadRes = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .field('documentType', 'ATTACHMENT')
        .attach('file', Buffer.from('delete me'), {
          filename: 'to-delete.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      const delId = uploadRes.body.document.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/documents/${delId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(200);

      expect(res.body.status).toBe('DELETED');

      // Verify it no longer appears in GET
      await request(app.getHttpServer())
        .get(`/api/documents/${delId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });

    it('should return 404 for unknown id', async () => {
      await request(app.getHttpServer())
        .delete('/api/documents/nonexistent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Branch-Id', branchId)
        .expect(404);
    });
  });
});
