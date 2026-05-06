import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DemandCalendarService } from './demand-calendar.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

const ORG = 'org-1';
const BRANCH = 'branch-1';
const USER = 'user-1';
const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const CTX = { organizationId: ORG, branchId: BRANCH };

const mockEntry = {
  id: 'cal-1',
  orgId: ORG,
  branchId: BRANCH,
  calendarType: 'BRUNCH',
  daypart: 'BREAKFAST',
  title: 'Sunday Brunch',
  dateStart: new Date('2026-01-05'),
  dateEnd: new Date('2026-03-29'),
  expectedCovers: 80,
  demandMultiplier: 1.5,
  revenueUpliftPct: 30,
  itemNotes: 'Extra eggs, bacon',
  notes: 'Weekly brunch',
  eventId: null,
  isActive: true,
  createdById: USER,
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePrisma() {
  return {
    demandCalendarEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    event: {
      findFirst: jest.fn(),
    },
  };
}

describe('DemandCalendarService', () => {
  let service: DemandCalendarService;
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemandCalendarService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DemandCalendarService>(DemandCalendarService);
  });

  describe('list', () => {
    it('returns all entries for branch', async () => {
      prisma.demandCalendarEntry.findMany.mockResolvedValue([mockEntry]);
      const result = await service.list(CTX, {});
      expect(result).toEqual([mockEntry]);
      expect(prisma.demandCalendarEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: ORG, branchId: BRANCH },
        }),
      );
    });

    it('filters by calendarType', async () => {
      prisma.demandCalendarEntry.findMany.mockResolvedValue([mockEntry]);
      await service.list(CTX, { calendarType: 'BRUNCH' } as any);
      expect(prisma.demandCalendarEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ calendarType: 'BRUNCH' }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns an entry by id', async () => {
      prisma.demandCalendarEntry.findFirst.mockResolvedValue(mockEntry);
      const result = await service.getById(CTX, 'cal-1');
      expect(result).toEqual(mockEntry);
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.demandCalendarEntry.findFirst.mockResolvedValue(null);
      await expect(service.getById(CTX, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      calendarType: 'BRUNCH' as const,
      title: 'Sunday Brunch',
      dateStart: '2026-01-05',
      dateEnd: '2026-03-29',
      expectedCovers: 80,
      demandMultiplier: 1.5,
    };

    it('creates a demand calendar entry', async () => {
      prisma.demandCalendarEntry.create.mockResolvedValue(mockEntry);
      prisma.demandCalendarEntry.findFirst.mockResolvedValueOnce(mockEntry); // getById after create
      const result = await service.create(USER, CTX, dto as any, META);
      expect(result).toEqual(mockEntry);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEMAND_CALENDAR_CREATED' }),
      );
    });

    it('throws BadRequestException if dateEnd < dateStart', async () => {
      await expect(
        service.create(
          USER,
          CTX,
          { ...dto, dateStart: '2026-03-29', dateEnd: '2026-01-05' } as any,
          META,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates an existing entry', async () => {
      const updatedEntry = { ...mockEntry, title: 'Updated' };
      prisma.demandCalendarEntry.findFirst.mockResolvedValueOnce(mockEntry); // existence check
      prisma.demandCalendarEntry.update.mockResolvedValue(updatedEntry);
      prisma.demandCalendarEntry.findFirst.mockResolvedValueOnce(updatedEntry); // getById after update
      const result = await service.update(USER, CTX, 'cal-1', { title: 'Updated' } as any, META);
      expect(result.title).toBe('Updated');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEMAND_CALENDAR_UPDATED' }),
      );
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.demandCalendarEntry.findFirst.mockResolvedValue(null);
      await expect(
        service.update(USER, CTX, 'bad-id', { title: 'X' } as any, META),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing entry', async () => {
      prisma.demandCalendarEntry.findFirst.mockResolvedValue(mockEntry);
      prisma.demandCalendarEntry.delete.mockResolvedValue(mockEntry);
      await service.delete(USER, CTX, 'cal-1', META);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEMAND_CALENDAR_DELETED' }),
      );
    });

    it('throws NotFoundException for unknown id', async () => {
      prisma.demandCalendarEntry.findFirst.mockResolvedValue(null);
      await expect(service.delete(USER, CTX, 'bad-id', META)).rejects.toThrow(NotFoundException);
    });
  });
});
