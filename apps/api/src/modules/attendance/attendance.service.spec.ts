import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: any;
  let audit: any;

  const ctx = { branchId: 'branch-1', organizationId: 'org-1' };
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  const mockEmployee = {
    id: 'emp-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeCode: 'EMP-00001',
    firstName: 'Alice',
    lastName: 'Nakamya',
    userId: 'user-1',
    status: 'ACTIVE',
  };

  const mockEmployee2 = {
    id: 'emp-2',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeCode: 'EMP-00002',
    firstName: 'Brian',
    lastName: 'Okello',
    userId: 'user-2',
    status: 'ACTIVE',
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mockAttendanceRecord = {
    id: 'att-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeId: 'emp-1',
    userId: 'user-1',
    attendanceDate: today,
    clockInAt: new Date(),
    clockOutAt: null,
    status: 'CLOCKED_IN',
    lateMinutes: 0,
    policyId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPolicy = {
    id: 'pol-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    name: 'Default Shift Policy',
    graceMinutes: 10,
    autoLateAfterMinutes: 15,
    allowSelfClockOutFix: false,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLeaveRequest = {
    id: 'leave-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    employeeId: 'emp-1',
    leaveType: 'SICK',
    startsAt: new Date('2025-04-01'),
    endsAt: new Date('2025-04-03'),
    reason: 'Medical checkup',
    status: 'PENDING',
    requestedById: 'user-1',
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockShiftSwap = {
    id: 'swap-1',
    orgId: 'org-1',
    branchId: 'branch-1',
    requesterEmployeeId: 'emp-1',
    targetEmployeeId: 'emp-2',
    shiftDate: new Date('2025-04-05'),
    reason: 'Family commitment',
    status: 'PENDING',
    approvedById: null,
    approvedAt: null,
    reviewNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      attendanceRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      attendancePolicy: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      leaveRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      shiftSwapRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      scheduleAssignment: {
        findFirst: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  // ── Clock In / Out ──

  describe('clockInOut', () => {
    it('should clock in an employee for today', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      prisma.attendancePolicy.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockResolvedValue(mockAttendanceRecord);

      const result = await service.clockInOut('user-1', ctx, { employeeId: 'emp-1' }, meta);

      expect(result).toBeDefined();
      expect(result.status).toBe('CLOCKED_IN');
      expect(prisma.attendanceRecord.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTENDANCE_CLOCK_IN' }),
      );
    });

    it('should clock out an already clocked-in employee', async () => {
      const clockedIn = { ...mockAttendanceRecord, clockOutAt: null };
      const clockedOut = { ...mockAttendanceRecord, clockOutAt: new Date(), status: 'CLOCKED_OUT' };
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.attendanceRecord.findUnique.mockResolvedValue(clockedIn);
      prisma.attendanceRecord.update.mockResolvedValue(clockedOut);

      const result = await service.clockInOut('user-1', ctx, { employeeId: 'emp-1' }, meta);

      expect(result.status).toBe('CLOCKED_OUT');
      expect(result.clockOutAt).toBeDefined();
      expect(prisma.attendanceRecord.update).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTENDANCE_CLOCK_OUT' }),
      );
    });

    it('should throw ConflictException if employee already clocked out today', async () => {
      const alreadyOut = { ...mockAttendanceRecord, clockOutAt: new Date(), status: 'CLOCKED_OUT' };
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.attendanceRecord.findUnique.mockResolvedValue(alreadyOut);

      await expect(
        service.clockInOut('user-1', ctx, { employeeId: 'emp-1' }, meta),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.clockInOut('user-1', ctx, { employeeId: 'emp-999' }, meta),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for employee from different org', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, orgId: 'other-org' });

      await expect(
        service.clockInOut('user-1', ctx, { employeeId: 'emp-1' }, meta),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject clocking an employee linked to another user', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, userId: 'user-2' });

      await expect(
        service.clockInOut('user-1', ctx, { employeeId: 'emp-1' }, meta),
      ).rejects.toThrow('Current user can only clock their own linked employee profile');
    });

    it('should apply attendance policy for late detection on clock-in', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.attendanceRecord.findUnique.mockResolvedValue(null);
      prisma.attendancePolicy.findFirst.mockResolvedValue(mockPolicy);
      prisma.attendanceRecord.create.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockAttendanceRecord,
          ...args.data,
          id: 'att-new',
        }),
      );

      const result = await service.clockInOut('user-1', ctx, { employeeId: 'emp-1' }, meta);

      expect(result).toBeDefined();
      expect(prisma.attendanceRecord.create).toHaveBeenCalledTimes(1);
      // Policy is applied (policyId set)
      expect(prisma.attendanceRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ policyId: 'pol-1' }),
        }),
      );
    });
  });

  // ── List Attendance ──

  describe('listAttendance', () => {
    it('should list attendance records with pagination', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([mockAttendanceRecord]);
      prisma.attendanceRecord.count.mockResolvedValue(1);

      const result = await service.listAttendance(ctx, { skip: '0', take: '20' });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by employeeId and status', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.count.mockResolvedValue(0);

      await service.listAttendance(ctx, {
        employeeId: 'emp-1',
        status: 'CLOCKED_IN' as any,
      });

      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
            status: 'CLOCKED_IN',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([]);
      prisma.attendanceRecord.count.mockResolvedValue(0);

      await service.listAttendance(ctx, {
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
      });

      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attendanceDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });
  });

  // ── Leave Requests ──

  describe('createLeaveRequest', () => {
    it('should create a leave request', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveRequest.create.mockResolvedValue(mockLeaveRequest);

      const result = await service.createLeaveRequest(
        'user-1',
        ctx,
        {
          employeeId: 'emp-1',
          leaveType: 'SICK' as any,
          startsAt: '2025-04-01',
          endsAt: '2025-04-03',
          reason: 'Medical checkup',
        },
        meta,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(prisma.leaveRequest.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEAVE_REQUEST_CREATED' }),
      );
    });

    it('should throw NotFoundException for unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.createLeaveRequest(
          'user-1',
          ctx,
          {
            employeeId: 'emp-999',
            leaveType: 'ANNUAL' as any,
            startsAt: '2025-04-01',
            endsAt: '2025-04-03',
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject leave creation for an employee linked to another user', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, userId: 'user-2' });

      await expect(
        service.createLeaveRequest(
          'user-1',
          ctx,
          {
            employeeId: 'emp-1',
            leaveType: 'ANNUAL' as any,
            startsAt: '2025-04-01',
            endsAt: '2025-04-03',
          },
          meta,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if endsAt before startsAt', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(
        service.createLeaveRequest(
          'user-1',
          ctx,
          {
            employeeId: 'emp-1',
            leaveType: 'SICK' as any,
            startsAt: '2025-04-05',
            endsAt: '2025-04-01',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for overlapping leave', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.leaveRequest.findFirst.mockResolvedValue(mockLeaveRequest);

      await expect(
        service.createLeaveRequest(
          'user-1',
          ctx,
          {
            employeeId: 'emp-1',
            leaveType: 'SICK' as any,
            startsAt: '2025-04-01',
            endsAt: '2025-04-03',
          },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listLeaveRequests', () => {
    it('should list leave requests with pagination', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([mockLeaveRequest]);
      prisma.leaveRequest.count.mockResolvedValue(1);

      const result = await service.listLeaveRequests(ctx, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by employeeId and status', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      await service.listLeaveRequests(ctx, {
        employeeId: 'emp-1',
        status: 'PENDING' as any,
      });

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('reviewLeaveRequest', () => {
    it('should approve a pending leave request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(mockLeaveRequest);
      prisma.leaveRequest.update.mockResolvedValue({
        ...mockLeaveRequest,
        status: 'APPROVED',
        reviewedById: 'user-1',
        reviewedAt: expect.any(Date),
      });

      const result = await service.reviewLeaveRequest(
        'user-1',
        ctx,
        'leave-1',
        { status: 'APPROVED' as any, reviewNotes: 'Approved for medical' },
        meta,
      );

      expect(result.status).toBe('APPROVED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEAVE_REQUEST_APPROVED' }),
      );
    });

    it('should reject a pending leave request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(mockLeaveRequest);
      prisma.leaveRequest.update.mockResolvedValue({
        ...mockLeaveRequest,
        status: 'REJECTED',
        reviewedById: 'user-1',
      });

      const result = await service.reviewLeaveRequest(
        'user-1',
        ctx,
        'leave-1',
        { status: 'REJECTED' as any, reviewNotes: 'Insufficient notice' },
        meta,
      );

      expect(result.status).toBe('REJECTED');
    });

    it('should throw NotFoundException for unknown leave request', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.reviewLeaveRequest(
          'user-1',
          ctx,
          'leave-999',
          {
            status: 'APPROVED' as any,
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already reviewed leave', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({
        ...mockLeaveRequest,
        status: 'APPROVED',
      });

      await expect(
        service.reviewLeaveRequest(
          'user-1',
          ctx,
          'leave-1',
          {
            status: 'REJECTED' as any,
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Shift Swaps ──

  describe('createShiftSwap', () => {
    it('should create a shift swap request', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockEmployee2);
      prisma.scheduleAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
      prisma.shiftSwapRequest.findFirst.mockResolvedValue(null);
      prisma.shiftSwapRequest.create.mockResolvedValue(mockShiftSwap);

      const result = await service.createShiftSwap(
        'user-1',
        ctx,
        {
          requesterEmployeeId: 'emp-1',
          targetEmployeeId: 'emp-2',
          shiftDate: '2025-04-05',
          reason: 'Family commitment',
        },
        meta,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(prisma.shiftSwapRequest.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SHIFT_SWAP_CREATED' }),
      );
    });

    it('should throw BadRequestException for same requester and target', async () => {
      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-1',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown requester', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-999',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown target', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(mockEmployee).mockResolvedValueOnce(null);

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-999',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject shift swap creation for a requester linked to another user', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, userId: 'user-2' });

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject shift swap creation when requester is outside the active branch', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        branchId: 'branch-2',
      });

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject shift swap creation when target is outside the active branch', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce({ ...mockEmployee2, branchId: 'branch-2' });

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject shift swap creation without a requester roster assignment', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockEmployee2);
      prisma.scheduleAssignment.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject shift swap creation without a target roster assignment', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockEmployee2);
      prisma.scheduleAssignment.findFirst
        .mockResolvedValueOnce({ id: 'assignment-1' })
        .mockResolvedValueOnce(null);

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate pending swap', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockEmployee2);
      prisma.scheduleAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
      prisma.shiftSwapRequest.findFirst.mockResolvedValue(mockShiftSwap);

      await expect(
        service.createShiftSwap(
          'user-1',
          ctx,
          {
            requesterEmployeeId: 'emp-1',
            targetEmployeeId: 'emp-2',
            shiftDate: '2025-04-05',
          },
          meta,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listShiftSwaps', () => {
    it('should list shift swaps with pagination', async () => {
      prisma.shiftSwapRequest.findMany.mockResolvedValue([mockShiftSwap]);
      prisma.shiftSwapRequest.count.mockResolvedValue(1);

      const result = await service.listShiftSwaps(ctx, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by employeeId (requester or target)', async () => {
      prisma.shiftSwapRequest.findMany.mockResolvedValue([]);
      prisma.shiftSwapRequest.count.mockResolvedValue(0);

      await service.listShiftSwaps(ctx, { employeeId: 'emp-1' });

      expect(prisma.shiftSwapRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ requesterEmployeeId: 'emp-1' }, { targetEmployeeId: 'emp-1' }],
          }),
        }),
      );
    });
  });

  describe('approveShiftSwap', () => {
    it('should approve a pending shift swap', async () => {
      prisma.shiftSwapRequest.findFirst.mockResolvedValue(mockShiftSwap);
      prisma.shiftSwapRequest.update.mockResolvedValue({
        ...mockShiftSwap,
        status: 'APPROVED',
        approvedById: 'user-1',
      });

      const result = await service.approveShiftSwap(
        'user-1',
        ctx,
        'swap-1',
        { status: 'APPROVED' as any, reviewNotes: 'Both employees confirmed' },
        meta,
      );

      expect(result.status).toBe('APPROVED');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SHIFT_SWAP_APPROVED' }),
      );
    });

    it('should reject a pending shift swap', async () => {
      prisma.shiftSwapRequest.findFirst.mockResolvedValue(mockShiftSwap);
      prisma.shiftSwapRequest.update.mockResolvedValue({
        ...mockShiftSwap,
        status: 'REJECTED',
        approvedById: 'user-1',
      });

      const result = await service.approveShiftSwap(
        'user-1',
        ctx,
        'swap-1',
        { status: 'REJECTED' as any },
        meta,
      );

      expect(result.status).toBe('REJECTED');
    });

    it('should throw NotFoundException for unknown swap', async () => {
      prisma.shiftSwapRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.approveShiftSwap(
          'user-1',
          ctx,
          'swap-999',
          {
            status: 'APPROVED' as any,
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already reviewed swap', async () => {
      prisma.shiftSwapRequest.findFirst.mockResolvedValue({
        ...mockShiftSwap,
        status: 'APPROVED',
      });

      await expect(
        service.approveShiftSwap(
          'user-1',
          ctx,
          'swap-1',
          {
            status: 'REJECTED' as any,
          },
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Attendance Policies ──

  describe('createAttendancePolicy', () => {
    it('should create an attendance policy', async () => {
      prisma.attendancePolicy.create.mockResolvedValue(mockPolicy);

      const result = await service.createAttendancePolicy(
        'user-1',
        ctx,
        {
          name: 'Default Shift Policy',
          graceMinutes: 10,
          autoLateAfterMinutes: 15,
        },
        meta,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Default Shift Policy');
      expect(prisma.attendancePolicy.create).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTENDANCE_POLICY_CREATED' }),
      );
    });

    it('should default graceMinutes to 0 and allowSelfClockOutFix to false', async () => {
      prisma.attendancePolicy.create.mockResolvedValue({
        ...mockPolicy,
        graceMinutes: 0,
        allowSelfClockOutFix: false,
      });

      await service.createAttendancePolicy('user-1', ctx, { name: 'Strict Policy' }, meta);

      expect(prisma.attendancePolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            graceMinutes: 0,
            allowSelfClockOutFix: false,
          }),
        }),
      );
    });
  });

  describe('listAttendancePolicies', () => {
    it('should list policies for org and branch', async () => {
      prisma.attendancePolicy.findMany.mockResolvedValue([mockPolicy]);

      const result = await service.listAttendancePolicies(ctx);

      expect(result).toHaveLength(1);
      expect(prisma.attendancePolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: 'org-1',
            OR: [{ branchId: 'branch-1' }, { branchId: null }],
          }),
        }),
      );
    });
  });

  describe('updateAttendancePolicy', () => {
    it('should update an existing policy', async () => {
      prisma.attendancePolicy.findFirst.mockResolvedValue(mockPolicy);
      prisma.attendancePolicy.update.mockResolvedValue({
        ...mockPolicy,
        graceMinutes: 15,
      });

      const result = await service.updateAttendancePolicy(
        'user-1',
        ctx,
        'pol-1',
        { graceMinutes: 15 },
        meta,
      );

      expect(result.graceMinutes).toBe(15);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ATTENDANCE_POLICY_UPDATED' }),
      );
    });

    it('should throw NotFoundException for unknown policy', async () => {
      prisma.attendancePolicy.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAttendancePolicy(
          'user-1',
          ctx,
          'pol-999',
          {
            name: 'Updated',
          },
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deactivate a policy', async () => {
      prisma.attendancePolicy.findFirst.mockResolvedValue(mockPolicy);
      prisma.attendancePolicy.update.mockResolvedValue({
        ...mockPolicy,
        active: false,
      });

      const result = await service.updateAttendancePolicy(
        'user-1',
        ctx,
        'pol-1',
        { active: false },
        meta,
      );

      expect(result.active).toBe(false);
    });
  });
});
