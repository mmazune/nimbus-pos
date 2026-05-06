import { Test } from '@nestjs/testing';
import { DigestService } from './digest.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { SourceSignalService } from './source-signal.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DigestService', () => {
    let service: DigestService;
    let prisma: Record<string, any>;
    let dispatcher: { dispatch: jest.Mock };
    let signals: Record<string, jest.Mock>;
    let audit: { log: jest.Mock };

    beforeEach(async () => {
        prisma = {
            membership: { findFirst: jest.fn() },
            branch: { findFirst: jest.fn() },
            digestSchedule: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            alertChannel: { findMany: jest.fn() },
            alertDelivery: { create: jest.fn() },
        };
        audit = { log: jest.fn() };
        dispatcher = { dispatch: jest.fn() };
        signals = {
            evaluateLowStock: jest.fn().mockResolvedValue([]),
            evaluateCashVariance: jest.fn().mockResolvedValue([]),
            evaluateBookingReminders: jest.fn().mockResolvedValue([]),
            evaluateBillingPaymentFailures: jest.fn().mockResolvedValue([]),
            evaluateOverdueVendorBills: jest.fn().mockResolvedValue([]),
            evaluateLargeWastageSpike: jest.fn().mockResolvedValue([]),
        };

        const m = await Test.createTestingModule({
            providers: [
                DigestService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: ChannelDispatcherService, useValue: dispatcher },
                { provide: SourceSignalService, useValue: signals },
            ],
        }).compile();
        service = m.get(DigestService);
    });

    it('refuses duplicate digest code', async () => {
        prisma.digestSchedule.findUnique.mockResolvedValue({ id: 'x' });
        await expect(
            service.create('u', 'org-1', {
                code: 'd1',
                name: 'D',
                digestType: 'owner-daily',
                frequency: 'DAILY',
                channelCodes: ['email'],
            } as any),
        ).rejects.toThrow();
    });

    it('runs an active digest and dispatches per channel', async () => {
        prisma.digestSchedule.findFirst.mockResolvedValue({
            id: 's1',
            code: 'd1',
            name: 'Daily',
            digestType: 'owner-daily',
            frequency: 'DAILY',
            hourLocal: 7,
            dayOfWeek: null,
            status: 'ACTIVE',
            channelCodes: ['email', 'slack'],
        });
        prisma.alertChannel.findMany.mockResolvedValue([
            { id: 'c1', code: 'email', type: 'EMAIL', status: 'ACTIVE', config: { to: 'a@b.com' } },
            { id: 'c2', code: 'slack', type: 'SLACK', status: 'ACTIVE', config: {} },
        ]);
        dispatcher.dispatch.mockResolvedValue({ ok: true, sentAt: new Date(), mode: 'mock' });
        prisma.alertDelivery.create.mockImplementation((args: any) => ({ id: 'd', ...args.data }));
        prisma.digestSchedule.update.mockResolvedValue({});

        const out = await service.runDigest('u', 'org-1', 's1');
        expect(out.deliveries.length).toBe(2);
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'DIGEST_RUN_TRIGGERED' }),
        );
    });

    it('refuses to run a disabled digest', async () => {
        prisma.digestSchedule.findFirst.mockResolvedValue({
            id: 's1',
            status: 'DISABLED',
            channelCodes: ['email'],
        });
        await expect(service.runDigest('u', 'org-1', 's1')).rejects.toThrow(ConflictException);
    });

    it('returns NotFound for missing digest', async () => {
        prisma.digestSchedule.findFirst.mockResolvedValue(null);
        await expect(service.runDigest('u', 'org-1', 'nope')).rejects.toThrow(NotFoundException);
    });
});
