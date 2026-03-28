import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackService } from './feedback.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('FeedbackService', () => {
    let service: FeedbackService;
    let prisma: any;
    let audit: any;

    const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

    beforeEach(async () => {
        prisma = {
            feedbackRequest: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
            feedback: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                update: jest.fn(),
            },
            feedbackTag: {
                create: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
            },
            $transaction: jest.fn((fn: any) => fn(prisma)),
        };
        audit = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FeedbackService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();

        service = module.get<FeedbackService>(FeedbackService);
    });

    // ── NPS / Sentiment Helpers ──

    describe('computeNpsBucket', () => {
        it('should return DETRACTOR for score 0-6', () => {
            expect(service.computeNpsBucket(0)).toBe('DETRACTOR');
            expect(service.computeNpsBucket(6)).toBe('DETRACTOR');
        });

        it('should return PASSIVE for score 7-8', () => {
            expect(service.computeNpsBucket(7)).toBe('PASSIVE');
            expect(service.computeNpsBucket(8)).toBe('PASSIVE');
        });

        it('should return PROMOTER for score 9-10', () => {
            expect(service.computeNpsBucket(9)).toBe('PROMOTER');
            expect(service.computeNpsBucket(10)).toBe('PROMOTER');
        });
    });

    describe('inferSentiment', () => {
        it('should return CRITICAL for npsScore 0-3', () => {
            expect(service.inferSentiment(undefined, 0)).toBe('CRITICAL');
            expect(service.inferSentiment(undefined, 3)).toBe('CRITICAL');
        });

        it('should return NEGATIVE for npsScore 4-6', () => {
            expect(service.inferSentiment(undefined, 5)).toBe('NEGATIVE');
        });

        it('should return NEUTRAL for npsScore 7-8', () => {
            expect(service.inferSentiment(undefined, 8)).toBe('NEUTRAL');
        });

        it('should return POSITIVE for npsScore 9-10', () => {
            expect(service.inferSentiment(undefined, 10)).toBe('POSITIVE');
        });

        it('should fall back to rating when no npsScore', () => {
            expect(service.inferSentiment(1)).toBe('CRITICAL');
            expect(service.inferSentiment(2)).toBe('NEGATIVE');
            expect(service.inferSentiment(3)).toBe('NEUTRAL');
            expect(service.inferSentiment(4)).toBe('POSITIVE');
            expect(service.inferSentiment(5)).toBe('POSITIVE');
        });

        it('should return NEUTRAL when neither provided', () => {
            expect(service.inferSentiment()).toBe('NEUTRAL');
        });
    });

    // ── Create Feedback Request ──

    describe('createFeedbackRequest', () => {
        it('should create a feedback request with generated token', async () => {
            prisma.feedbackRequest.create.mockResolvedValue({
                id: 'req-1',
                orgId: 'org-1',
                branchId: 'branch-1',
                token: 'abc123',
                source: 'QR',
                status: 'PENDING',
            });

            const result = await service.createFeedbackRequest(
                'user-1',
                ctx,
                { source: 'QR' as any },
                meta,
            );

            expect(result.id).toBe('req-1');
            expect(result.status).toBe('PENDING');
            expect(prisma.feedbackRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        orgId: 'org-1',
                        branchId: 'branch-1',
                        source: 'QR',
                        status: 'PENDING',
                        token: expect.any(String),
                    }),
                }),
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FEEDBACK_REQUEST_CREATED' }),
            );
        });
    });

    // ── Token Lookup ──

    describe('lookupToken', () => {
        it('should return request info for valid token', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                source: 'QR',
                status: 'PENDING',
                customerName: 'Test',
                expiresAt: new Date(Date.now() + 86400000),
                branchId: 'branch-1',
                orderId: null,
                reservationId: null,
                eventId: null,
                branch: { name: 'Main Branch' },
            });
            prisma.feedbackRequest.update.mockResolvedValue({});

            const result = await service.lookupToken('valid-token');

            expect(result.id).toBe('req-1');
            expect(result.branchName).toBe('Main Branch');
            expect(prisma.feedbackRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'OPENED' }),
                }),
            );
        });

        it('should throw NotFoundException for invalid token', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue(null);
            await expect(service.lookupToken('invalid')).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException for expired token', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: 'PENDING',
                expiresAt: new Date(Date.now() - 1000),
            });
            await expect(service.lookupToken('expired')).rejects.toThrow(BadRequestException);
        });

        it('should throw ConflictException for already submitted token', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: 'SUBMITTED',
                expiresAt: new Date(Date.now() + 86400000),
            });
            await expect(service.lookupToken('submitted')).rejects.toThrow(ConflictException);
        });

        it('should throw BadRequestException for cancelled token', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: 'CANCELLED',
                expiresAt: new Date(Date.now() + 86400000),
            });
            await expect(service.lookupToken('cancelled')).rejects.toThrow(BadRequestException);
        });
    });

    // ── Submit Public Feedback ──

    describe('submitPublicFeedback', () => {
        it('should submit feedback for valid request', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                orgId: 'org-1',
                branchId: 'branch-1',
                orderId: null,
                reservationId: null,
                eventId: null,
                status: 'OPENED',
                expiresAt: new Date(Date.now() + 86400000),
                customerName: 'Test',
                customerPhone: null,
                customerEmail: null,
            });
            prisma.feedback.create.mockResolvedValue({
                id: 'fb-1',
                rating: 5,
                npsScore: 9,
                npsBucket: 'PROMOTER',
                sentiment: 'POSITIVE',
                status: 'NEW',
            });
            prisma.feedbackRequest.update.mockResolvedValue({});

            const result = await service.submitPublicFeedback(
                { token: 'valid-token', rating: 5, npsScore: 9, comment: 'Great!' },
                meta,
            );

            expect(result.id).toBe('fb-1');
            expect(prisma.feedback.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        rating: 5,
                        npsScore: 9,
                        npsBucket: 'PROMOTER',
                        sentiment: 'POSITIVE',
                        status: 'NEW',
                    }),
                }),
            );
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FEEDBACK_SUBMITTED' }),
            );
        });

        it('should reject duplicate submission', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: 'SUBMITTED',
            });

            await expect(service.submitPublicFeedback({ token: 'dup', rating: 3 }, meta)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should reject expired request on submit', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: 'OPENED',
                expiresAt: new Date(Date.now() - 1000),
            });

            await expect(service.submitPublicFeedback({ token: 'exp', rating: 3 }, meta)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should reject submission for cancelled request', async () => {
            prisma.feedbackRequest.findUnique.mockResolvedValue({
                id: 'req-1',
                status: 'CANCELLED',
                expiresAt: new Date(Date.now() + 86400000),
            });

            await expect(service.submitPublicFeedback({ token: 'can', rating: 3 }, meta)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    // ── Tag Feedback ──

    describe('tagFeedback', () => {
        it('should add a tag to feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1' });
            prisma.feedbackTag.findUnique.mockResolvedValue(null);
            prisma.feedbackTag.create.mockResolvedValue({
                id: 'tag-1',
                feedbackId: 'fb-1',
                tagKey: 'FOOD_QUALITY',
                tagLabel: 'Food Quality',
            });

            const result = await service.tagFeedback(
                'fb-1',
                'user-1',
                ctx,
                { tagKey: 'FOOD_QUALITY', tagLabel: 'Food Quality' },
                meta,
            );

            expect(result.tagKey).toBe('FOOD_QUALITY');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FEEDBACK_TAGGED' }),
            );
        });

        it('should reject duplicate tag', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1' });
            prisma.feedbackTag.findUnique.mockResolvedValue({ id: 'existing-tag' });

            await expect(
                service.tagFeedback(
                    'fb-1',
                    'user-1',
                    ctx,
                    { tagKey: 'FOOD_QUALITY', tagLabel: 'Food Quality' },
                    meta,
                ),
            ).rejects.toThrow(ConflictException);
        });

        it('should throw NotFoundException for non-existent feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue(null);

            await expect(
                service.tagFeedback('nope', 'user-1', ctx, { tagKey: 'X', tagLabel: 'X' }, meta),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── Acknowledge Feedback ──

    describe('acknowledgeFeedback', () => {
        it('should acknowledge NEW feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1', status: 'NEW' });
            prisma.feedback.update.mockResolvedValue({
                id: 'fb-1',
                status: 'ACKNOWLEDGED',
                acknowledgedById: 'user-1',
            });

            const result = await service.acknowledgeFeedback('fb-1', 'user-1', ctx, meta);

            expect(result.status).toBe('ACKNOWLEDGED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FEEDBACK_ACKNOWLEDGED' }),
            );
        });

        it('should reject acknowledging already acknowledged feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1', status: 'ACKNOWLEDGED' });

            await expect(service.acknowledgeFeedback('fb-1', 'user-1', ctx, meta)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── Resolve Feedback ──

    describe('resolveFeedback', () => {
        it('should resolve feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1', status: 'ACKNOWLEDGED' });
            prisma.feedback.update.mockResolvedValue({
                id: 'fb-1',
                status: 'RESOLVED',
                resolvedById: 'user-1',
            });

            const result = await service.resolveFeedback(
                'fb-1',
                'user-1',
                ctx,
                { resolutionNotes: 'Fixed' },
                meta,
            );

            expect(result.status).toBe('RESOLVED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FEEDBACK_RESOLVED' }),
            );
        });

        it('should reject resolving already resolved feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1', status: 'RESOLVED' });

            await expect(
                service.resolveFeedback('fb-1', 'user-1', ctx, { resolutionNotes: 'x' }, meta),
            ).rejects.toThrow(ConflictException);
        });

        it('should reject resolving dismissed feedback', async () => {
            prisma.feedback.findFirst.mockResolvedValue({ id: 'fb-1', status: 'DISMISSED' });

            await expect(
                service.resolveFeedback('fb-1', 'user-1', ctx, { resolutionNotes: 'x' }, meta),
            ).rejects.toThrow(ConflictException);
        });
    });

    // ── Cancel Feedback Request ──

    describe('cancelFeedbackRequest', () => {
        it('should cancel a pending request', async () => {
            prisma.feedbackRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'PENDING' });
            prisma.feedbackRequest.update.mockResolvedValue({
                id: 'req-1',
                status: 'CANCELLED',
            });

            const result = await service.cancelFeedbackRequest('req-1', 'user-1', ctx, meta);

            expect(result.status).toBe('CANCELLED');
            expect(audit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'FEEDBACK_REQUEST_CANCELLED' }),
            );
        });

        it('should reject cancelling already submitted request', async () => {
            prisma.feedbackRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'SUBMITTED' });

            await expect(service.cancelFeedbackRequest('req-1', 'user-1', ctx, meta)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should reject cancelling already cancelled request', async () => {
            prisma.feedbackRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'CANCELLED' });

            await expect(service.cancelFeedbackRequest('req-1', 'user-1', ctx, meta)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    // ── NPS Summary ──

    describe('getNpsSummary', () => {
        it('should compute NPS summary from feedback data', async () => {
            prisma.feedback.findMany.mockResolvedValue([
                { npsScore: 9, npsBucket: 'PROMOTER', rating: 5, sentiment: 'POSITIVE' },
                { npsScore: 10, npsBucket: 'PROMOTER', rating: 5, sentiment: 'POSITIVE' },
                { npsScore: 7, npsBucket: 'PASSIVE', rating: 3, sentiment: 'NEUTRAL' },
                { npsScore: 4, npsBucket: 'DETRACTOR', rating: 2, sentiment: 'NEGATIVE' },
            ]);

            const result = await service.getNpsSummary(ctx, {});

            expect(result.totalResponses).toBe(4);
            expect(result.promoters).toBe(2);
            expect(result.passives).toBe(1);
            expect(result.detractors).toBe(1);
            // NPS = ((2/4) - (1/4)) * 100 = 25
            expect(result.npsScore).toBe(25);
            expect(result.avgRating).toBe(3.75);
        });

        it('should return zeroes for no feedback', async () => {
            prisma.feedback.findMany.mockResolvedValue([]);

            const result = await service.getNpsSummary(ctx, {});

            expect(result.totalResponses).toBe(0);
            expect(result.npsScore).toBe(0);
            expect(result.avgRating).toBeNull();
        });
    });

    // ── List Feedback ──

    describe('listFeedback', () => {
        it('should return paginated feedback list', async () => {
            prisma.feedback.findMany.mockResolvedValue([{ id: 'fb-1' }]);
            prisma.feedback.count.mockResolvedValue(1);

            const result = await service.listFeedback(ctx, {});

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    // ── Branch Isolation ──

    describe('branch isolation', () => {
        it('should scope feedback request creation to branch', async () => {
            const otherCtx = { branchId: 'branch-2', organizationId: 'org-1' };
            prisma.feedbackRequest.create.mockResolvedValue({
                id: 'req-2',
                branchId: 'branch-2',
                status: 'PENDING',
            });

            await service.createFeedbackRequest('user-1', otherCtx, { source: 'QR' as any }, meta);

            expect(prisma.feedbackRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ branchId: 'branch-2' }),
                }),
            );
        });
    });
});
