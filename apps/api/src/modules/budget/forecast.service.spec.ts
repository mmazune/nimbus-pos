import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ForecastService } from './forecast.service';
import { DemandCalendarService } from './demand-calendar.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';

const ORG = 'org-1';
const BRANCH = 'branch-1';
const _USER = 'user-1';
const _META = { ipAddress: '127.0.0.1', userAgent: 'jest' };
const _CTX = { organizationId: ORG, branchId: BRANCH };

describe('ForecastService', () => {
  let service: ForecastService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        {
          provide: PrismaService,
          useValue: {
            forecastRun: { findFirst: jest.fn(), create: jest.fn() },
            reservation: { findMany: jest.fn().mockResolvedValue([]) },
            order: { findMany: jest.fn().mockResolvedValue([]) },
            inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
            journalLine: { groupBy: jest.fn().mockResolvedValue([]) },
            procurementSuggestion: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: DemandCalendarService,
          useValue: { getEntriesForWindow: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
  });

  // ── buildDaypartSummaries ──

  // Helper: compute dateStr the same way the service does (toISOString().split('T')[0])
  function dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  describe('buildDaypartSummaries', () => {
    it('computes baseline covers from historical orders', () => {
      // Use local noon so getDay()/getHours() and toISOString date are consistent
      const horizonStart = new Date(2026, 0, 5, 12, 0); // Monday local
      const historicalOrders = [
        // 4 Monday lunch orders (local noon → getHours()=12 → LUNCH)
        {
          createdAt: new Date(2025, 11, 8, 12, 0),
          total: new Prisma.Decimal('100'),
          items: [{ quantity: 10 }],
        },
        {
          createdAt: new Date(2025, 11, 15, 12, 0),
          total: new Prisma.Decimal('100'),
          items: [{ quantity: 12 }],
        },
        {
          createdAt: new Date(2025, 11, 22, 12, 0),
          total: new Prisma.Decimal('100'),
          items: [{ quantity: 8 }],
        },
        {
          createdAt: new Date(2025, 11, 29, 12, 0),
          total: new Prisma.Decimal('100'),
          items: [{ quantity: 14 }],
        },
      ];

      const result = service.buildDaypartSummaries(horizonStart, 1, historicalOrders, [], []);

      const ds = dateStr(horizonStart);
      const lunchEntry = result.find((s) => s.daypart === 'LUNCH' && s.date === ds);
      expect(lunchEntry).toBeDefined();
      expect(lunchEntry!.baselineCovers).toBeGreaterThan(0);
      expect(lunchEntry!.calendarUplift).toBe(0);
      expect(lunchEntry!.reservationCovers).toBe(0);
    });

    it('applies calendar uplift via demandMultiplier', () => {
      const horizonStart = new Date(2026, 0, 5, 12, 0);
      const historicalOrders = [
        {
          createdAt: new Date(2025, 11, 8, 12, 0),
          total: new Prisma.Decimal('100'),
          items: [{ quantity: 40 }],
        },
      ];
      const calendarEntries = [
        {
          dateStart: new Date(2026, 0, 5, 0, 0),
          dateEnd: new Date(2026, 0, 5, 23, 59),
          daypart: 'LUNCH',
          calendarType: 'BRUNCH',
          expectedCovers: null,
          demandMultiplier: new Prisma.Decimal('1.5'),
          title: 'Sunday Brunch',
        },
      ];

      const result = service.buildDaypartSummaries(
        horizonStart,
        1,
        historicalOrders,
        calendarEntries,
        [],
      );

      const lunchEntry = result.find((s) => s.daypart === 'LUNCH');
      expect(lunchEntry!.calendarUplift).toBeGreaterThan(0);
      expect(lunchEntry!.demandDrivers).toContain('BRUNCH: Sunday Brunch');
    });

    it('overlays reservation covers', () => {
      const horizonStart = new Date(2026, 0, 5, 12, 0);
      const reservations = [
        { partySize: 8, reservationAt: new Date(2026, 0, 5, 19, 30) },
        { partySize: 12, reservationAt: new Date(2026, 0, 5, 20, 0) },
      ];

      const result = service.buildDaypartSummaries(horizonStart, 1, [], [], reservations);

      const ds = dateStr(horizonStart);
      const dinnerEntry = result.find((s) => s.daypart === 'DINNER' && s.date === ds);
      expect(dinnerEntry!.reservationCovers).toBe(20);
    });

    it('detects busy periods (>1.3x baseline or +20)', () => {
      const horizonStart = new Date(2026, 0, 5, 12, 0);
      const historicalOrders = [
        {
          createdAt: new Date(2025, 11, 8, 12, 0),
          total: new Prisma.Decimal('100'),
          items: [{ quantity: 30 }],
        },
      ];
      const calendarEntries = [
        {
          dateStart: new Date(2026, 0, 5, 0, 0),
          dateEnd: new Date(2026, 0, 5, 23, 59),
          daypart: 'LUNCH',
          calendarType: 'SPORTS_NIGHT',
          expectedCovers: null,
          demandMultiplier: new Prisma.Decimal('2.0'),
          title: 'Big Game',
        },
      ];

      const result = service.buildDaypartSummaries(
        horizonStart,
        1,
        historicalOrders,
        calendarEntries,
        [],
      );

      const lunchEntry = result.find((s) => s.daypart === 'LUNCH');
      expect(lunchEntry!.isBusy).toBe(true);
      expect(lunchEntry!.busyReason).toContain('demand calendar');
    });
  });

  // ── buildDemandSignals ──

  describe('buildDemandSignals', () => {
    it('generates CALENDAR_ENTRY signals from calendar entries', () => {
      const signals = service.buildDemandSignals(
        [
          {
            id: 'cal-1',
            calendarType: 'BRUNCH',
            title: 'Sunday Brunch',
            dateStart: new Date('2026-01-05'),
            dateEnd: new Date('2026-01-05'),
            daypart: 'BREAKFAST',
            expectedCovers: 80,
            demandMultiplier: new Prisma.Decimal('1.5'),
          },
        ],
        [],
        new Date('2026-01-05'),
        new Date('2026-01-05'),
      );

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('CALENDAR_ENTRY');
      expect(signals[0].impact).toContain('80');
    });

    it('generates RESERVATIONS signal for dates with >10 covers', () => {
      const signals = service.buildDemandSignals(
        [],
        [
          { partySize: 6, reservationAt: new Date('2026-01-05T18:00:00Z') },
          { partySize: 8, reservationAt: new Date('2026-01-05T19:00:00Z') },
        ],
        new Date('2026-01-05'),
        new Date('2026-01-05'),
      );

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('RESERVATIONS');
      expect(signals[0].impact).toContain('14');
    });
  });

  // ── classifyUrgency ──

  describe('classifyUrgency', () => {
    it('URGENT_LOCAL_BUY when <1 day of stock', () => {
      // currentStock=5, projectedUsage=30 over 3 days → 10/day → 0.5 days of stock
      const result = service.classifyUrgency(25, 5, 10, 30, 3, false);
      expect(result).toBe('URGENT_LOCAL_BUY');
    });

    it('STOCK_UP_BEFORE_EVENT when mentioned in calendar + deficit', () => {
      const result = service.classifyUrgency(10, 20, 10, 30, 3, true);
      expect(result).toBe('STOCK_UP_BEFORE_EVENT');
    });

    it('ORDER_NEXT_PO when deficit exists and stock at safety', () => {
      // currentStock=10, safety=10, projectedUsage=15 over 3 days → 5/day → 2 days stock
      const result = service.classifyUrgency(5, 10, 10, 15, 3, false);
      expect(result).toBe('ORDER_NEXT_PO');
    });

    it('MONITOR when stock near safety but no deficit', () => {
      // currentStock=11, safety=10, projectedUsage=3 over 3 days → 1/day → 11 days stock
      const result = service.classifyUrgency(-8, 11, 10, 3, 3, false);
      expect(result).toBe('MONITOR');
    });
  });

  // ── projectItemUsage ──

  describe('projectItemUsage', () => {
    it('projects usage from BOM and detects deficit', () => {
      const inventoryItems = [
        {
          id: 'inv-1',
          name: 'Chicken Breast',
          unit: 'kg',
          reorderLevel: new Prisma.Decimal('10'),
          reorderQty: new Prisma.Decimal('20'),
          theoreticalUnitCost: new Prisma.Decimal('5'),
          stockBatches: [{ remainingQty: new Prisma.Decimal('8') }],
        },
      ];
      const historicalOrders = [
        {
          items: [
            {
              quantity: 20,
              menuItem: {
                recipeIngredients: [
                  {
                    inventoryItemId: 'inv-1',
                    qtyPerUnit: new Prisma.Decimal('0.3'),
                    wastePct: new Prisma.Decimal('10'),
                  },
                ],
              },
            },
          ],
        },
      ];

      const result = service.projectItemUsage(
        inventoryItems,
        historicalOrders,
        60, // projected covers
        [],
        3, // horizon days
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
      const chickenProjection = result.find((p) => p.inventoryItemId === 'inv-1');
      expect(chickenProjection).toBeDefined();
      expect(chickenProjection!.projectedUsage).toBeGreaterThan(0);
      expect(chickenProjection!.currentStock).toBe(8);
    });

    it('applies 1.5x uplift for items mentioned in calendar itemNotes', () => {
      const inventoryItems = [
        {
          id: 'inv-1',
          name: 'Eggs',
          unit: 'pc',
          reorderLevel: new Prisma.Decimal('50'),
          reorderQty: new Prisma.Decimal('100'),
          theoreticalUnitCost: new Prisma.Decimal('0.5'),
          stockBatches: [{ remainingQty: new Prisma.Decimal('30') }],
        },
      ];
      const historicalOrders = [
        {
          items: [
            {
              quantity: 40,
              menuItem: {
                recipeIngredients: [
                  {
                    inventoryItemId: 'inv-1',
                    qtyPerUnit: new Prisma.Decimal('2'),
                    wastePct: new Prisma.Decimal('5'),
                  },
                ],
              },
            },
          ],
        },
      ];
      const calendarEntries = [
        { id: 'cal-1', calendarType: 'BRUNCH', itemNotes: 'Extra eggs, bacon' },
      ];

      const result = service.projectItemUsage(
        inventoryItems,
        historicalOrders,
        60,
        calendarEntries,
        3,
      );

      const eggProjection = result.find((p) => p.inventoryItemId === 'inv-1');
      expect(eggProjection).toBeDefined();
      // Should be elevated due to calendar mention
      expect(eggProjection!.rationale).toContain('demand calendar');
    });
  });

  // ── hourToDaypart ──

  describe('hourToDaypart', () => {
    it('maps 7am to BREAKFAST', () => expect(service.hourToDaypart(7)).toBe('BREAKFAST'));
    it('maps 12pm to LUNCH', () => expect(service.hourToDaypart(12)).toBe('LUNCH'));
    it('maps 15pm to AFTERNOON', () => expect(service.hourToDaypart(15)).toBe('AFTERNOON'));
    it('maps 19pm to DINNER', () => expect(service.hourToDaypart(19)).toBe('DINNER'));
    it('maps 23pm to LATE_NIGHT', () => expect(service.hourToDaypart(23)).toBe('LATE_NIGHT'));
    it('maps 2am to LATE_NIGHT', () => expect(service.hourToDaypart(2)).toBe('LATE_NIGHT'));
  });
});
