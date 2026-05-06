import { Test } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { ChannelDispatcherService } from './channel-dispatcher.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
    ForbiddenException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';

describe('AlertsService', () => {
    let service: AlertsService;
    let prisma: Record<string, any>;
    let audit: { log: jest.Mock };
    let dispatcher: { dispatch: jest.Mock };

    beforeEach(async () => {
        prisma = {
            membership: { findFirst: jest.fn() },
            branch: { findFirst: jest.fn() },
            alertRule: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            alertChannel: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            alertDelivery: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
        };
        audit = { log: jest.fn() };
        dispatcher = { dispatch: jest.fn() };

        const m = await Test.createTestingModule({
            providers: [
                AlertsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuditService, useValue: audit },
                { provide: ChannelDispatcherService, useValue: dispatcher },
            ],
        }).compile();

        service = m.get(AlertsService);
    });

    it('resolves org context from active membership', async () => {
        prisma.membership.findFirst.mockResolvedValue({ organizationId: 'org-1' });
        const ctx = await service.resolveOrgContext('user-1');
        expect(ctx.organizationId).toBe('org-1');
    });

    it('throws ForbiddenException when no membership', async () => {
        prisma.membership.findFirst.mockResolvedValue(null);
        await expect(service.resolveOrgContext('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('creates an alert rule and audits it', async () => {
        prisma.alertRule.findUnique.mockResolvedValue(null);
        prisma.alertRule.create.mockResolvedValue({ id: 'r1', code: 'low-stock', type: 'LOW_STOCK', severity: 'WARNING' });
        const rule = await service.createRule('user-1', 'org-1', {
            code: 'low-stock',
            name: 'Low stock',
            type: 'LOW_STOCK',
        } as any);
        expect(rule.id).toBe('r1');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'ALERT_RULE_CREATED' }),
        );
    });

    it('refuses duplicate rule code', async () => {
        prisma.alertRule.findUnique.mockResolvedValue({ id: 'rx' });
        await expect(
            service.createRule('user-1', 'org-1', {
                code: 'dup',
                name: 'Dup',
                type: 'LOW_STOCK',
            } as any),
        ).rejects.toThrow(ConflictException);
    });

    it('dispatches a test alert and persists a SENT delivery', async () => {
        prisma.alertChannel.findMany.mockResolvedValue([
            { id: 'ch1', code: 'email', type: 'EMAIL', status: 'ACTIVE', config: { to: 'a@b.com' } },
        ]);
        dispatcher.dispatch.mockResolvedValue({ ok: true, sentAt: new Date(), mode: 'mock' });
        prisma.alertDelivery.create.mockImplementation((args: any) => ({
            id: 'd1',
            ...args.data,
        }));

        const out = await service.sendTestAlert('user-1', 'org-1', {
            channelCodes: ['email'],
            severity: 'INFO',
            message: 'hello',
        } as any);

        expect(out.count).toBe(1);
        expect(out.deliveries[0].status).toBe('SENT');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'ALERT_TEST_DISPATCHED' }),
        );
    });

    it('persists RETRY_SCHEDULED on retryable failure', async () => {
        prisma.alertChannel.findMany.mockResolvedValue([
            { id: 'ch1', code: 'slack', type: 'SLACK', status: 'ACTIVE', config: {} },
        ]);
        dispatcher.dispatch.mockResolvedValue({
            ok: false,
            retryable: true,
            failureReason: 'X',
            error: 'boom',
            mode: 'mock',
        });
        prisma.alertDelivery.create.mockImplementation((args: any) => ({
            id: 'd2',
            ...args.data,
        }));

        const out = await service.sendTestAlert('user-1', 'org-1', {
            channelCodes: ['slack'],
            forceFailure: true,
        } as any);
        expect(out.deliveries[0].status).toBe('RETRY_SCHEDULED');
    });

    it('retry: marks SENT when dispatch succeeds', async () => {
        prisma.alertDelivery.findFirst.mockResolvedValue({
            id: 'd9',
            orgId: 'org-1',
            status: 'RETRY_SCHEDULED',
            attemptCount: 1,
            maxAttempts: 3,
            payload: { title: 't', message: 'm', severity: 'INFO', alertType: 'TEST' },
            channel: { id: 'ch1', code: 'slack', type: 'SLACK', status: 'ACTIVE', config: {} },
        });
        dispatcher.dispatch.mockResolvedValue({ ok: true, sentAt: new Date(), mode: 'mock' });
        prisma.alertDelivery.update.mockImplementation((args: any) => ({ id: 'd9', ...args.data }));

        const out = await service.retryDelivery('user-1', 'org-1', 'd9');
        expect(out.status).toBe('SENT');
        expect(audit.log).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'ALERT_DELIVERY_RETRIED' }),
        );
    });

    it('retry: refuses when delivery missing', async () => {
        prisma.alertDelivery.findFirst.mockResolvedValue(null);
        await expect(service.retryDelivery('u', 'org-1', 'nope')).rejects.toThrow(NotFoundException);
    });
});
