import { Test } from '@nestjs/testing';
import { OwnerLiveService } from './owner-live.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SourceSignalService } from './source-signal.service';

describe('OwnerLiveService', () => {
    let service: OwnerLiveService;
    let prisma: Record<string, any>;
    let signals: Record<string, jest.Mock>;

    beforeEach(async () => {
        prisma = {
            membership: { findFirst: jest.fn().mockResolvedValue({ organizationId: 'org-1' }) },
            ownerLiveEvent: { findMany: jest.fn().mockResolvedValue([]) },
        };
        signals = {
            evaluateLowStock: jest.fn().mockResolvedValue([{ sourceRef: 'a' }]),
            evaluateCashVariance: jest.fn().mockResolvedValue([]),
            evaluateBookingReminders: jest.fn().mockResolvedValue([{ sourceRef: 'b' }, { sourceRef: 'c' }]),
            evaluateBillingPaymentFailures: jest.fn().mockResolvedValue([]),
        };
        const m = await Test.createTestingModule({
            providers: [
                OwnerLiveService,
                { provide: PrismaService, useValue: prisma },
                { provide: SourceSignalService, useValue: signals },
            ],
        }).compile();
        service = m.get(OwnerLiveService);
    });

    it('returns aggregated counts and live sections', async () => {
        const out = await service.getLiveFeed('org-1', {} as any);
        expect(out.counts.lowStock).toBe(1);
        expect(out.counts.upcomingReservations).toBe(2);
        expect(out.notes.publicDinerPaymentExecution).toMatch(/pending/);
    });
});
