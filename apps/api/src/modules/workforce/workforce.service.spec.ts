import { Test, TestingModule } from '@nestjs/testing';
import { WorkforceService } from './workforce.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('WorkforceService', () => {
  let service: WorkforceService;
  let prisma: any;
  let audit: any;

  const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const mockTemplate = {
    id: 'tmpl-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    code: 'MORNING',
    name: 'Morning Shift',
    startsAtTime: '06:00',
    endsAtTime: '14:00',
    roleKey: null,
    positionId: null,
    expectedHeadcount: 2,
    active: true,
    notes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchedule = {
    id: 'sched-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    name: 'Week 1 Schedule',
    dateFrom: new Date('2025-04-07'),
    dateTo: new Date('2025-04-13'),
    status: 'DRAFT',
    version: 1,
    publishedAt: null,
    publishedById: null,
    notes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignments: [],
  };

  const mockCoverageRule = {
    id: 'rule-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    name: 'Kitchen Coverage',
    roleKey: 'COOK',
    positionId: null,
    minimumHeadcount: 2,
    appliesFromTime: '06:00',
    appliesToTime: '14:00',
    status: 'ACTIVE',
    severity: 'HIGH',
    notes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployee = {
    id: 'emp-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeCode: 'EMP-00001',
    firstName: 'Alice',
    lastName: 'Nakamya',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    prisma = {
      shiftTemplate: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      schedule: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      scheduleAssignment: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      coverageRule: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      position: {
        findFirst: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkforceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<WorkforceService>(WorkforceService);
  });

  // ── Shift Templates ──

  describe('createShiftTemplate', () => {
    it('should create a shift template', async () => {
      prisma.shiftTemplate.findUnique.mockResolvedValue(null);
      prisma.shiftTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.createShiftTemplate(
        'user-1',
        ctx,
        {
          code: 'MORNING',
          name: 'Morning Shift',
          startsAtTime: '06:00',
          endsAtTime: '14:00',
        },
        meta,
      );

      expect(result).toBeDefined();
      expect(result.code).toBe('MORNING');
      expect(prisma.shiftTemplate.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SHIFT_TEMPLATE_CREATED' }),
      );
    });

    it('should throw ConflictException for duplicate code', async () => {
      prisma.shiftTemplate.findUnique.mockResolvedValue(mockTemplate);

      await expect(
        service.createShiftTemplate(
          'user-1',
          ctx,
          {
            code: 'MORNING',
            name: 'Morning Shift',
            startsAtTime: '06:00',
            endsAtTime: '14:00',
          },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for invalid positionId', async () => {
      prisma.shiftTemplate.findUnique.mockResolvedValue(null);
      prisma.position.findFirst.mockResolvedValue(null);

      await expect(
        service.createShiftTemplate(
          'user-1',
          ctx,
          {
            code: 'EVE',
            name: 'Evening Shift',
            startsAtTime: '14:00',
            endsAtTime: '22:00',
            positionId: 'pos-nonexistent',
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create template with position when valid', async () => {
      prisma.shiftTemplate.findUnique.mockResolvedValue(null);
      prisma.position.findFirst.mockResolvedValue({ id: 'pos-1', orgId: 'org-1' });
      prisma.shiftTemplate.create.mockResolvedValue({
        ...mockTemplate,
        positionId: 'pos-1',
      });

      const result = await service.createShiftTemplate(
        'user-1',
        ctx,
        {
          code: 'MORNING',
          name: 'Morning Shift',
          startsAtTime: '06:00',
          endsAtTime: '14:00',
          positionId: 'pos-1',
        },
        meta,
      );

      expect(result.positionId).toBe('pos-1');
    });
  });

  describe('listShiftTemplates', () => {
    it('should list templates with pagination', async () => {
      prisma.shiftTemplate.findMany.mockResolvedValue([mockTemplate]);
      prisma.shiftTemplate.count.mockResolvedValue(1);

      const result = await service.listShiftTemplates(ctx, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by active and roleKey', async () => {
      prisma.shiftTemplate.findMany.mockResolvedValue([]);
      prisma.shiftTemplate.count.mockResolvedValue(0);

      await service.listShiftTemplates(ctx, { active: true, roleKey: 'COOK' });

      expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
            roleKey: 'COOK',
          }),
        }),
      );
    });

    it('should filter by search query', async () => {
      prisma.shiftTemplate.findMany.mockResolvedValue([]);
      prisma.shiftTemplate.count.mockResolvedValue(0);

      await service.listShiftTemplates(ctx, { search: 'morning' });

      expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { name: { contains: 'morning', mode: 'insensitive' } },
                  { code: { contains: 'morning', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });

  // ── Schedules ──

  describe('createSchedule', () => {
    it('should create a schedule without assignments', async () => {
      prisma.schedule.create.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule(
        'user-1',
        ctx,
        {
          name: 'Week 1 Schedule',
          dateFrom: '2025-04-07',
          dateTo: '2025-04-13',
        },
        meta,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Week 1 Schedule');
      expect(prisma.schedule.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SCHEDULE_CREATED' }),
      );
    });

    it('should create a schedule with assignments', async () => {
      prisma.shiftTemplate.findFirst.mockResolvedValue(mockTemplate);
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);
      prisma.schedule.create.mockResolvedValue({
        ...mockSchedule,
        assignments: [
          {
            id: 'assign-1',
            scheduleId: 'sched-1',
            shiftTemplateId: 'tmpl-1',
            employeeId: 'emp-1',
            shiftDate: new Date('2025-04-07'),
          },
        ],
      });

      const result = await service.createSchedule(
        'user-1',
        ctx,
        {
          name: 'Week 1 Schedule',
          dateFrom: '2025-04-07',
          dateTo: '2025-04-13',
          assignments: [
            {
              shiftTemplateId: 'tmpl-1',
              employeeId: 'emp-1',
              shiftDate: '2025-04-07',
            },
          ],
        },
        meta,
      );

      expect(result.assignments).toHaveLength(1);
    });

    it('should throw BadRequestException if dateTo before dateFrom', async () => {
      await expect(
        service.createSchedule(
          'user-1',
          ctx,
          {
            name: 'Bad Range',
            dateFrom: '2025-04-13',
            dateTo: '2025-04-07',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for assignment outside schedule range', async () => {
      prisma.shiftTemplate.findFirst.mockResolvedValue(mockTemplate);
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);

      await expect(
        service.createSchedule(
          'user-1',
          ctx,
          {
            name: 'Week 1',
            dateFrom: '2025-04-07',
            dateTo: '2025-04-13',
            assignments: [
              {
                shiftTemplateId: 'tmpl-1',
                employeeId: 'emp-1',
                shiftDate: '2025-04-20', // outside range
              },
            ],
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid template in assignment', async () => {
      prisma.shiftTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.createSchedule(
          'user-1',
          ctx,
          {
            name: 'Week 1',
            dateFrom: '2025-04-07',
            dateTo: '2025-04-13',
            assignments: [
              {
                shiftTemplateId: 'tmpl-999',
                employeeId: 'emp-1',
                shiftDate: '2025-04-07',
              },
            ],
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid employee in assignment', async () => {
      prisma.shiftTemplate.findFirst.mockResolvedValue(mockTemplate);
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.createSchedule(
          'user-1',
          ctx,
          {
            name: 'Week 1',
            dateFrom: '2025-04-07',
            dateTo: '2025-04-13',
            assignments: [
              {
                shiftTemplateId: 'tmpl-1',
                employeeId: 'emp-999',
                shiftDate: '2025-04-07',
              },
            ],
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listSchedules', () => {
    it('should list schedules with pagination', async () => {
      prisma.schedule.findMany.mockResolvedValue([mockSchedule]);
      prisma.schedule.count.mockResolvedValue(1);

      const result = await service.listSchedules(ctx, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.count.mockResolvedValue(0);

      await service.listSchedules(ctx, { status: 'DRAFT' });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });
  });

  describe('getSchedule', () => {
    it('should return a schedule by id', async () => {
      prisma.schedule.findFirst.mockResolvedValue(mockSchedule);

      const result = await service.getSchedule(ctx, 'sched-1');

      expect(result.id).toBe('sched-1');
    });

    it('should throw NotFoundException for unknown schedule', async () => {
      prisma.schedule.findFirst.mockResolvedValue(null);

      await expect(service.getSchedule(ctx, 'sched-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('publishSchedule', () => {
    it('should publish a DRAFT schedule', async () => {
      prisma.schedule.findFirst.mockResolvedValue(mockSchedule);
      prisma.schedule.update.mockResolvedValue({
        ...mockSchedule,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: 'user-1',
        version: 2,
      });

      const result = await service.publishSchedule('user-1', ctx, 'sched-1', {}, meta);

      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeDefined();
      expect(prisma.schedule.update).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SCHEDULE_PUBLISHED' }),
      );
    });

    it('should throw NotFoundException for unknown schedule', async () => {
      prisma.schedule.findFirst.mockResolvedValue(null);

      await expect(service.publishSchedule('user-1', ctx, 'sched-999', {}, meta)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if schedule is not DRAFT', async () => {
      prisma.schedule.findFirst.mockResolvedValue({
        ...mockSchedule,
        status: 'PUBLISHED',
      });

      await expect(service.publishSchedule('user-1', ctx, 'sched-1', {}, meta)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('archiveSchedule', () => {
    it('should archive a schedule', async () => {
      prisma.schedule.findFirst.mockResolvedValue({
        ...mockSchedule,
        status: 'PUBLISHED',
      });
      prisma.schedule.update.mockResolvedValue({
        ...mockSchedule,
        status: 'ARCHIVED',
      });

      const result = await service.archiveSchedule('user-1', ctx, 'sched-1', meta);

      expect(result.status).toBe('ARCHIVED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SCHEDULE_ARCHIVED' }),
      );
    });

    it('should throw NotFoundException for unknown schedule', async () => {
      prisma.schedule.findFirst.mockResolvedValue(null);

      await expect(service.archiveSchedule('user-1', ctx, 'sched-999', meta)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already archived', async () => {
      prisma.schedule.findFirst.mockResolvedValue({
        ...mockSchedule,
        status: 'ARCHIVED',
      });

      await expect(service.archiveSchedule('user-1', ctx, 'sched-1', meta)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── Coverage Rules ──

  describe('createCoverageRule', () => {
    it('should create a coverage rule', async () => {
      prisma.coverageRule.create.mockResolvedValue(mockCoverageRule);

      const result = await service.createCoverageRule(
        'user-1',
        ctx,
        { name: 'Kitchen Coverage', roleKey: 'COOK', minimumHeadcount: 2 },
        meta,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Kitchen Coverage');
      expect(prisma.coverageRule.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COVERAGE_RULE_CREATED' }),
      );
    });

    it('should throw NotFoundException for invalid positionId', async () => {
      prisma.position.findFirst.mockResolvedValue(null);

      await expect(
        service.createCoverageRule(
          'user-1',
          ctx,
          { name: 'FOH', positionId: 'pos-nonexistent' },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listCoverageRules', () => {
    it('should list coverage rules for org/branch', async () => {
      prisma.coverageRule.findMany.mockResolvedValue([mockCoverageRule]);

      const result = await service.listCoverageRules(ctx);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Kitchen Coverage');
    });
  });

  // ── Roster ──

  describe('getRoster', () => {
    it('should return roster from published schedules', async () => {
      const mockAssignment = {
        id: 'assign-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        scheduleId: 'sched-1',
        shiftTemplateId: 'tmpl-1',
        employeeId: 'emp-1',
        shiftDate: new Date('2025-04-07'),
        schedule: { ...mockSchedule, status: 'PUBLISHED' },
        shiftTemplate: mockTemplate,
        employee: mockEmployee,
      };
      prisma.scheduleAssignment.findMany.mockResolvedValue([mockAssignment]);
      prisma.scheduleAssignment.count.mockResolvedValue(1);

      const result = await service.getRoster(ctx, {
        dateFrom: '2025-04-07',
        dateTo: '2025-04-13',
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by employeeId', async () => {
      prisma.scheduleAssignment.findMany.mockResolvedValue([]);
      prisma.scheduleAssignment.count.mockResolvedValue(0);

      await service.getRoster(ctx, { employeeId: 'emp-1' });

      expect(prisma.scheduleAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
          }),
        }),
      );
    });
  });

  // ── Coverage Gaps ──

  describe('getCoverageGaps', () => {
    it('should return gaps when assignments below minimum', async () => {
      prisma.coverageRule.findMany.mockResolvedValue([mockCoverageRule]);
      prisma.scheduleAssignment.findMany.mockResolvedValue([]);

      const result = await service.getCoverageGaps(ctx, '2025-04-07', '2025-04-07');

      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.gaps[0].deficit).toBe(2);
      expect(result.gaps[0].severity).toBe('HIGH');
    });

    it('should return no gaps when coverage is met', async () => {
      prisma.coverageRule.findMany.mockResolvedValue([mockCoverageRule]);
      prisma.scheduleAssignment.findMany.mockResolvedValue([
        {
          id: 'a1',
          roleKey: 'COOK',
          shiftDate: new Date('2025-04-07'),
          shiftTemplate: {
            ...mockTemplate,
            roleKey: 'COOK',
            startsAtTime: '06:00',
            endsAtTime: '14:00',
          },
        },
        {
          id: 'a2',
          roleKey: 'COOK',
          shiftDate: new Date('2025-04-07'),
          shiftTemplate: {
            ...mockTemplate,
            roleKey: 'COOK',
            startsAtTime: '06:00',
            endsAtTime: '14:00',
          },
        },
      ]);

      const result = await service.getCoverageGaps(ctx, '2025-04-07', '2025-04-07');

      expect(result.gaps).toHaveLength(0);
    });

    it('should return empty message when no rules defined', async () => {
      prisma.coverageRule.findMany.mockResolvedValue([]);

      const result = await service.getCoverageGaps(ctx, '2025-04-07', '2025-04-13');

      expect(result.gaps).toHaveLength(0);
      expect(result.message).toBeDefined();
    });
  });
});
