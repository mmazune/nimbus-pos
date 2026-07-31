import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;
  let audit: any;

  const ctx = {
    branchId: 'branch-1',
    organizationId: 'org-1',
  };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(async () => {
    prisma = {
      anomalyRule: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      anomalyEvent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        // Default: the concurrency-safe conditional claim matches one row.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      riskThreshold: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      staffRiskSnapshot: {
        findFirst: jest.fn(),
      },
      order: {
        groupBy: jest.fn(),
      },
      discount: {
        groupBy: jest.fn(),
      },
      tillSession: {
        findMany: jest.fn(),
      },
      shift: {
        findMany: jest.fn(),
      },
      refund: {
        groupBy: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ── Create Rule ──

  it('should create a rule', async () => {
    prisma.anomalyRule.findUnique.mockResolvedValueOnce(null);
    prisma.anomalyRule.create.mockResolvedValue({
      id: 'rule-1',
      orgId: 'org-1',
      branchId: 'branch-1',
      code: 'VOID-SPIKE-01',
      name: 'Void Spike',
      type: 'VOID_SPIKE',
      severity: 'HIGH',
      status: 'ACTIVE',
    });

    const result = await service.createRule(
      'user-1',
      ctx,
      {
        code: 'VOID-SPIKE-01',
        name: 'Void Spike',
        type: 'VOID_SPIKE',
        severity: 'HIGH',
        metricKey: 'order.void.count_per_staff',
        operator: '>=',
        thresholdValue: 5,
        windowMinutes: 60,
      },
      meta,
    );

    expect(result.code).toBe('VOID-SPIKE-01');
    expect(prisma.anomalyRule.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'anomaly-rule.create' }),
    );
  });

  it('should reject duplicate rule code', async () => {
    prisma.anomalyRule.findUnique.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.createRule(
        'user-1',
        ctx,
        {
          code: 'VOID-SPIKE-01',
          name: 'Void Spike',
          type: 'VOID_SPIKE',
          severity: 'HIGH',
          metricKey: 'order.void.count_per_staff',
          operator: '>=',
        },
        meta,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ── Update Rule ──

  it('should update a rule', async () => {
    prisma.anomalyRule.findFirst.mockResolvedValueOnce({ id: 'rule-1', orgId: 'org-1' });
    prisma.anomalyRule.update.mockResolvedValue({ id: 'rule-1', name: 'Updated' });

    const result = await service.updateRule('rule-1', 'user-1', ctx, { name: 'Updated' }, meta);

    expect(result.name).toBe('Updated');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'anomaly-rule.update' }),
    );
  });

  it('should throw NotFoundException for non-existent rule update', async () => {
    prisma.anomalyRule.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateRule('nonexistent', 'user-1', ctx, { name: 'X' }, meta),
    ).rejects.toThrow(NotFoundException);
  });

  // ── List Rules ──

  it('should list rules for branch and org-wide', async () => {
    prisma.anomalyRule.findMany.mockResolvedValueOnce([
      { id: 'r1', code: 'R1', branchId: 'branch-1' },
      { id: 'r2', code: 'R2', branchId: null },
    ]);

    const result = await service.listRules(ctx);

    expect(result).toHaveLength(2);
    expect(prisma.anomalyRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: 'org-1',
          OR: [{ branchId: 'branch-1' }, { branchId: null }],
        },
      }),
    );
  });

  // ── List Anomalies ──

  it('should list anomalies with pagination', async () => {
    prisma.anomalyEvent.findMany.mockResolvedValueOnce([{ id: 'a1' }]);
    prisma.anomalyEvent.count.mockResolvedValueOnce(1);

    const result = await service.listAnomalies(ctx, { limit: 10, offset: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it('should filter anomalies by status and type', async () => {
    prisma.anomalyEvent.findMany.mockResolvedValueOnce([]);
    prisma.anomalyEvent.count.mockResolvedValueOnce(0);

    await service.listAnomalies(ctx, { status: 'OPEN', type: 'VOID_SPIKE' });

    expect(prisma.anomalyEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'OPEN',
          type: 'VOID_SPIKE',
        }),
      }),
    );
  });

  // ── Acknowledge Anomaly ──

  it('should acknowledge an OPEN anomaly', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      status: 'OPEN',
    });
    prisma.anomalyEvent.update.mockResolvedValue({
      id: 'a1',
      status: 'ACKNOWLEDGED',
      acknowledgedById: 'user-1',
    });

    const result = await service.acknowledgeAnomaly(
      'a1',
      'user-1',
      ctx,
      {
        resolutionNotes: 'Reviewed',
      },
      meta,
    );

    expect(result.status).toBe('ACKNOWLEDGED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'anomaly-event.acknowledge' }),
    );
  });

  it('should reject acknowledging non-OPEN anomaly', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      status: 'ACKNOWLEDGED',
    });

    await expect(service.acknowledgeAnomaly('a1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw NotFoundException for non-existent anomaly acknowledge', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.acknowledgeAnomaly('nonexistent', 'user-1', ctx, {}, meta),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when the anomaly was concurrently claimed (ack updateMany count 0)', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      branchId: 'branch-1',
      status: 'OPEN',
    });
    prisma.anomalyEvent.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.acknowledgeAnomaly('a1', 'user-1', ctx, {}, meta)).rejects.toThrow(
      ConflictException,
    );
  });

  it('scopes the acknowledge lookup + conditional claim to the caller branch (branch isolation)', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      branchId: 'branch-1',
      status: 'OPEN',
    });
    await service.acknowledgeAnomaly('a1', 'user-1', ctx, {}, meta);
    expect(prisma.anomalyEvent.findFirst.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ id: 'a1', orgId: 'org-1', branchId: 'branch-1' }),
    );
    expect(prisma.anomalyEvent.updateMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ id: 'a1', branchId: 'branch-1', status: 'OPEN' }),
    );
  });

  // ── Resolve Anomaly ──

  it('should resolve an ACKNOWLEDGED anomaly', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      status: 'ACKNOWLEDGED',
    });
    prisma.anomalyEvent.update.mockResolvedValue({
      id: 'a1',
      status: 'RESOLVED',
    });

    const result = await service.resolveAnomaly(
      'a1',
      'user-1',
      ctx,
      {
        resolutionNotes: 'False positive',
      },
      meta,
    );

    expect(result.status).toBe('RESOLVED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'anomaly-event.resolve' }),
    );
  });

  it('should reject resolving non-ACKNOWLEDGED anomaly', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      status: 'OPEN',
    });

    await expect(
      service.resolveAnomaly('a1', 'user-1', ctx, { resolutionNotes: 'No' }, meta),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when the anomaly was concurrently claimed (resolve updateMany count 0)', async () => {
    prisma.anomalyEvent.findFirst.mockResolvedValueOnce({
      id: 'a1',
      orgId: 'org-1',
      branchId: 'branch-1',
      status: 'ACKNOWLEDGED',
    });
    prisma.anomalyEvent.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.resolveAnomaly('a1', 'user-1', ctx, { resolutionNotes: 'Done' }, meta),
    ).rejects.toThrow(ConflictException);
  });

  // ── Risk Dashboard ──

  it('should return risk dashboard data', async () => {
    prisma.anomalyEvent.count.mockResolvedValueOnce(5);
    prisma.anomalyEvent.groupBy
      .mockResolvedValueOnce([{ severity: 'HIGH', _count: 3 }])
      .mockResolvedValueOnce([{ type: 'VOID_SPIKE', _count: 2 }])
      .mockResolvedValueOnce([{ actorUserId: 'u1', _count: 4 }]);

    const result = await service.getRiskDashboard(ctx, {});

    expect(result.openAnomalies).toBe(5);
    expect(result.severityBreakdown).toHaveLength(1);
    expect(result.typeBreakdown).toHaveLength(1);
    expect(result.topStaffByAnomalies).toHaveLength(1);
    expect(result.windowStart).toBeDefined();
    expect(result.windowEnd).toBeDefined();
  });

  // ── Staff Risk ──

  it('should return staff risk data', async () => {
    prisma.staffRiskSnapshot.findFirst.mockResolvedValueOnce({
      id: 's1',
      riskScore: new Decimal(25),
    });
    prisma.anomalyEvent.findMany.mockResolvedValueOnce([
      { id: 'a1', type: 'VOID_SPIKE', severity: 'HIGH' },
    ]);

    const result = await service.getStaffRisk('user-1', ctx);

    expect(result.snapshot).toBeDefined();
    expect(result.recentAnomalies).toHaveLength(1);
  });

  // ── Thresholds ──

  it('should list thresholds', async () => {
    prisma.riskThreshold.findMany.mockResolvedValueOnce([
      { id: 't1', key: 'void_rate_pct', value: new Decimal(10) },
    ]);

    const result = await service.listThresholds(ctx);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('void_rate_pct');
  });

  it('should update a threshold', async () => {
    prisma.riskThreshold.findFirst.mockResolvedValueOnce({
      id: 't1',
      orgId: 'org-1',
      key: 'void_rate_pct',
    });
    prisma.riskThreshold.update.mockResolvedValue({
      id: 't1',
      value: new Decimal(15),
    });

    const result = await service.updateThreshold('t1', 'user-1', ctx, { value: 15 }, meta);

    expect(Number(result.value)).toBe(15);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'risk-threshold.update' }),
    );
  });

  it('should throw NotFoundException for non-existent threshold', async () => {
    prisma.riskThreshold.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateThreshold('nonexistent', 'user-1', ctx, { value: 10 }, meta),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Recalculate ──

  it('should run recalculate and evaluate rules', async () => {
    prisma.anomalyRule.findMany.mockResolvedValueOnce([
      {
        id: 'rule-1',
        code: 'VOID-SPIKE-01',
        type: 'VOID_SPIKE',
        severity: 'HIGH',
        windowMinutes: 60,
        thresholdValue: new Decimal(5),
        name: 'Void Spike',
      },
    ]);
    prisma.order.groupBy.mockResolvedValueOnce([{ userId: 'u1', _count: 7 }]);
    prisma.anomalyEvent.create.mockResolvedValue({ id: 'ae-1' });

    const result = await service.recalculateAnomalies('user-1', ctx, meta);

    expect(result.rulesEvaluated).toBe(1);
    expect(result.results[0].ruleCode).toBe('VOID-SPIKE-01');
    expect(result.results[0].detected).toBe(1);
    expect(prisma.anomalyEvent.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'anomaly.recalculate' }),
    );
  });

  it('should skip unknown rule types during recalculate', async () => {
    prisma.anomalyRule.findMany.mockResolvedValueOnce([
      {
        id: 'rule-x',
        code: 'CUSTOM-01',
        type: 'CUSTOM',
        severity: 'LOW',
        windowMinutes: 60,
        thresholdValue: new Decimal(1),
        name: 'Custom',
      },
    ]);

    const result = await service.recalculateAnomalies('user-1', ctx, meta);

    expect(result.rulesEvaluated).toBe(1);
    expect(result.results[0].detected).toBe(0);
  });
});
