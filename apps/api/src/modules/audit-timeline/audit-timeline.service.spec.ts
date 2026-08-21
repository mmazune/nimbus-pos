import { Test, TestingModule } from '@nestjs/testing';
import { AuditTimelineReadService } from './audit-timeline.service';
import { PrismaService } from '../../common/prisma';

const ORG = 'org-1';
const BRANCH_A = 'branch-a';
const BRANCH_B = 'branch-b';

/**
 * B5-F4 (backend gap batch 3): `GET /api/audit/timeline` used to honour a
 * branch only via the OPTIONAL `?branchId=` query param and ignored
 * `X-Branch-Id` entirely — the default read mixed every branch in the org
 * together. These tests prove the before/after: `X-Branch-Id` now scopes
 * every read by default, and an explicit `?branchId=` that disagrees with
 * the acting branch cannot be used to leak another branch's audit trail.
 */
describe('AuditTimelineReadService (B5-F4 branch scoping)', () => {
  let service: AuditTimelineReadService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      branch: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditTimelineReadService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditTimelineReadService>(AuditTimelineReadService);
  });

  it('scopes the default read (no ?branchId=) to the acting X-Branch-Id — the fix', async () => {
    await service.query({ organizationId: ORG, branchId: BRANCH_A }, {});

    const call = prisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual(
      expect.arrayContaining([{ metadata: { path: ['branchId'], equals: BRANCH_A } }]),
    );
  });

  it('previously (the bug) no branch AND clause was added without an explicit ?branchId=', async () => {
    // Documented via the assertion above: before the fix, calling `query()`
    // with no `query.branchId` produced a `where.AND` containing only the
    // orgId clause — every branch's rows were mixed together. The current
    // behaviour always includes the branchId clause, which is the fix.
    await service.query({ organizationId: ORG, branchId: BRANCH_A }, {});
    const call = prisma.auditLog.findMany.mock.calls[0][0];
    const branchClauses = call.where.AND.filter((c: any) => c.metadata?.path?.[0] === 'branchId');
    expect(branchClauses.length).toBeGreaterThan(0);
  });

  it('an explicit ?branchId= matching the acting branch is a no-op', async () => {
    await service.query({ organizationId: ORG, branchId: BRANCH_A }, { branchId: BRANCH_A });

    const call = prisma.auditLog.findMany.mock.calls[0][0];
    const branchClauses = call.where.AND.filter((c: any) => c.metadata?.path?.[0] === 'branchId');
    expect(branchClauses).toEqual([{ metadata: { path: ['branchId'], equals: BRANCH_A } }]);
  });

  it('cross-branch: an explicit ?branchId= for ANOTHER branch cannot widen or redirect the read', async () => {
    await service.query({ organizationId: ORG, branchId: BRANCH_A }, { branchId: BRANCH_B });

    const call = prisma.auditLog.findMany.mock.calls[0][0];
    const branchClauses = call.where.AND.filter((c: any) => c.metadata?.path?.[0] === 'branchId');
    // Both the acting branch AND the requested branch are ANDed together —
    // an unsatisfiable combination, so the query returns nothing rather than
    // leaking branch B's rows to a caller acting in branch A.
    expect(branchClauses).toEqual([
      { metadata: { path: ['branchId'], equals: BRANCH_A } },
      { metadata: { path: ['branchId'], equals: BRANCH_B } },
    ]);
  });

  it('org scoping is unaffected — still resolves from callerCtx by default', async () => {
    await service.query({ organizationId: ORG, branchId: BRANCH_A }, {});
    const call = prisma.auditLog.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual(
      expect.arrayContaining([{ metadata: { path: ['orgId'], equals: ORG } }]),
    );
  });
});
