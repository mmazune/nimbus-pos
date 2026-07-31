import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  ClockAttendanceDto,
  ListAttendanceQueryDto,
  CreateLeaveRequestDto,
  ReviewLeaveRequestDto,
  ListLeaveQueryDto,
  CreateShiftSwapDto,
  ApproveShiftSwapDto,
  ListShiftSwapsQueryDto,
  CreateAttendancePolicyDto,
  UpdateAttendancePolicyDto,
} from './dto';
import { Prisma } from '@prisma/client';

/**
 * Hard upper bound on leave / shift-swap list page size. The DTO already rejects
 * take > 100, but the service clamps defensively so no caller (or a future
 * non-validated path) can request an unbounded history read. Aligns with the
 * bounded-history contract (Prompt 5A) and the discounts/reservations max=100.
 */
const MAX_LEAVE_PAGE_SIZE = 100;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Clock In / Clock Out ──

  async clockInOut(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: ClockAttendanceDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    // Validate employee exists in org
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee || employee.orgId !== orgId) {
      throw new NotFoundException(`Employee "${dto.employeeId}" not found in this organization`);
    }
    if (employee.userId !== userId) {
      throw new ForbiddenException('Current user can only clock their own linked employee profile');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if record exists for today
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: dto.employeeId,
          attendanceDate: today,
        },
      },
    });

    if (existing) {
      // Clock out
      if (existing.clockOutAt) {
        throw new ConflictException(`Employee "${dto.employeeId}" already clocked out for today`);
      }
      const now = new Date();
      const record = await this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          clockOutAt: now,
          status: 'CLOCKED_OUT',
          notes: dto.notes ?? existing.notes,
        },
      });
      await this.audit.log({
        action: 'ATTENDANCE_CLOCK_OUT',
        actorUserId: userId,
        entityType: 'AttendanceRecord',
        entityId: record.id,
        metadata: { employeeId: dto.employeeId, orgId, branchId, ...auditMeta },
        ipAddress: auditMeta?.ipAddress,
        userAgent: auditMeta?.userAgent,
      });
      return record;
    }

    // Clock in — find active policy for branch or org
    const policy = await this.prisma.attendancePolicy.findFirst({
      where: {
        orgId,
        active: true,
        OR: [{ branchId }, { branchId: null }],
      },
      orderBy: { branchId: 'desc' }, // prefer branch-specific
    });

    const now = new Date();
    let lateMinutes = 0;
    let status: 'CLOCKED_IN' | 'LATE' = 'CLOCKED_IN';

    if (policy?.autoLateAfterMinutes) {
      const graceMinutes = policy.graceMinutes ?? 0;
      const thresholdMinutes = policy.autoLateAfterMinutes + graceMinutes;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const defaultShiftStart = 8 * 60; // 8:00 AM
      if (currentMinutes > defaultShiftStart + thresholdMinutes) {
        lateMinutes = currentMinutes - defaultShiftStart - graceMinutes;
        if (lateMinutes > 0) {
          status = 'LATE';
        }
      }
    }

    const record = await this.prisma.attendanceRecord.create({
      data: {
        orgId,
        branchId,
        employeeId: dto.employeeId,
        userId,
        attendanceDate: today,
        clockInAt: now,
        status,
        lateMinutes: Math.max(0, lateMinutes),
        policyId: policy?.id ?? null,
        notes: dto.notes,
      },
    });

    await this.audit.log({
      action: 'ATTENDANCE_CLOCK_IN',
      actorUserId: userId,
      entityType: 'AttendanceRecord',
      entityId: record.id,
      metadata: { employeeId: dto.employeeId, orgId, branchId, status, lateMinutes, ...auditMeta },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }

  // ── List Attendance ──

  /**
   * Resolve `mine=true` to the actor's Employee.id. Returns null if no employee
   * record is linked to this user; callers should short-circuit to empty data.
   */
  private async resolveMineEmployeeId(actorUserId: string | undefined): Promise<string | null> {
    if (!actorUserId) return null;
    const employee = await this.prisma.employee.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    return employee?.id ?? null;
  }

  async listAttendance(
    ctx: { branchId: string; organizationId: string },
    query: ListAttendanceQueryDto,
    actorUserId?: string,
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const where: Prisma.AttendanceRecordWhereInput = { orgId, branchId };

    if (query.mine) {
      const mineId = await this.resolveMineEmployeeId(actorUserId);
      if (!mineId) return { data: [], total: 0 };
      where.employeeId = mineId;
    } else if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.attendanceDate = {};
      if (query.dateFrom) where.attendanceDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.attendanceDate.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        include: { employee: true, policy: true },
        orderBy: { attendanceDate: 'desc' },
        skip: Number(query.skip) || 0,
        take: Number(query.take) || 50,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return { data, total };
  }

  // ── Leave Requests ──

  async createLeaveRequest(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateLeaveRequestDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    // Validate employee
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee || employee.orgId !== orgId) {
      throw new NotFoundException(`Employee "${dto.employeeId}" not found in this organization`);
    }
    if (employee.userId !== userId) {
      throw new ForbiddenException(
        'Current user can only create leave for their own linked employee profile',
      );
    }

    // Validate date range
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt < startsAt) {
      throw new BadRequestException('endsAt must be on or after startsAt');
    }

    // Check overlapping leave
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
    });
    if (overlap) {
      throw new ConflictException(
        `Employee already has a ${overlap.status} leave request overlapping this period`,
      );
    }

    const record = await this.prisma.leaveRequest.create({
      data: {
        orgId,
        branchId,
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        startsAt,
        endsAt,
        reason: dto.reason,
        requestedById: userId,
      },
    });

    await this.audit.log({
      action: 'LEAVE_REQUEST_CREATED',
      actorUserId: userId,
      entityType: 'LeaveRequest',
      entityId: record.id,
      metadata: {
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }

  async listLeaveRequests(
    ctx: { branchId: string; organizationId: string },
    query: ListLeaveQueryDto,
    actorUserId?: string,
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const where: Prisma.LeaveRequestWhereInput = { orgId, branchId };

    if (query.mine) {
      const mineId = await this.resolveMineEmployeeId(actorUserId);
      if (!mineId) return { data: [], total: 0 };
      where.employeeId = mineId;
    } else if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.status) where.status = query.status;
    if (query.leaveType) where.leaveType = query.leaveType;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: { employee: true, requestedBy: true, reviewedBy: true },
        orderBy: { createdAt: 'desc' },
        skip: Number(query.skip) || 0,
        take: Math.min(Number(query.take) || 50, MAX_LEAVE_PAGE_SIZE),
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { data, total };
  }

  async reviewLeaveRequest(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    id: string,
    dto: ReviewLeaveRequestDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    // Leave requests are intentionally org-scoped (not branch-scoped) — an
    // employee's leave has a nullable branchId and is reviewed at org level.
    const existing = await this.prisma.leaveRequest.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Leave request "${id}" not found`);
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(
        `Leave request is already ${existing.status} and cannot be reviewed`,
      );
    }
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('Review status must be APPROVED or REJECTED');
    }

    // Concurrency-safe transition: only a row that is STILL PENDING can be
    // claimed. Two racing reviewers (e.g. approve vs reject) both pass the
    // precheck above, but exactly one conditional update matches — the loser
    // gets count 0 and a deterministic 409 instead of silently overwriting the
    // winner's terminal decision.
    const reviewedAt = new Date();
    const claim = await this.prisma.leaveRequest.updateMany({
      where: { id, orgId, status: 'PENDING' },
      data: {
        status: dto.status,
        reviewedById: userId,
        reviewedAt,
        reviewNotes: dto.reviewNotes,
      },
    });
    if (claim.count === 0) {
      throw new ConflictException(
        'Leave request was concurrently modified and is no longer pending',
      );
    }
    const record = {
      ...existing,
      status: dto.status,
      reviewedById: userId,
      reviewedAt,
      reviewNotes: dto.reviewNotes ?? null,
    };

    await this.audit.log({
      action: `LEAVE_REQUEST_${dto.status}`,
      actorUserId: userId,
      entityType: 'LeaveRequest',
      entityId: record.id,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }

  // ── Shift Swaps ──

  async createShiftSwap(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateShiftSwapDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    if (dto.requesterEmployeeId === dto.targetEmployeeId) {
      throw new BadRequestException('Requester and target employee must be different');
    }

    // Validate requester employee
    const requester = await this.prisma.employee.findUnique({
      where: { id: dto.requesterEmployeeId },
    });
    if (!requester || requester.orgId !== orgId) {
      throw new NotFoundException(
        `Requester employee "${dto.requesterEmployeeId}" not found in this organization`,
      );
    }
    if (requester.userId !== userId) {
      throw new ForbiddenException(
        'Current user can only create shift swaps for their own linked employee profile',
      );
    }
    if (requester.branchId !== branchId) {
      throw new BadRequestException('Requester employee is not assigned to this branch');
    }

    // Validate target employee
    const target = await this.prisma.employee.findUnique({
      where: { id: dto.targetEmployeeId },
    });
    if (!target || target.orgId !== orgId) {
      throw new NotFoundException(
        `Target employee "${dto.targetEmployeeId}" not found in this organization`,
      );
    }
    if (target.branchId !== branchId) {
      throw new BadRequestException('Target employee is not assigned to this branch');
    }

    const shiftDate = new Date(dto.shiftDate);

    const requesterAssignment = await this.prisma.scheduleAssignment.findFirst({
      where: {
        orgId,
        branchId,
        employeeId: dto.requesterEmployeeId,
        shiftDate,
        schedule: { status: 'PUBLISHED' },
      },
    });
    if (!requesterAssignment) {
      throw new BadRequestException(
        'Requester does not have a published roster assignment for this shift date',
      );
    }

    const targetAssignment = await this.prisma.scheduleAssignment.findFirst({
      where: {
        orgId,
        branchId,
        employeeId: dto.targetEmployeeId,
        shiftDate,
        schedule: { status: 'PUBLISHED' },
      },
    });
    if (!targetAssignment) {
      throw new BadRequestException(
        'Target employee does not have a published roster assignment for this shift date',
      );
    }

    // Check for duplicate pending swap on same date
    const existingSwap = await this.prisma.shiftSwapRequest.findFirst({
      where: {
        requesterEmployeeId: dto.requesterEmployeeId,
        shiftDate,
        status: 'PENDING',
      },
    });
    if (existingSwap) {
      throw new ConflictException(
        'Requester already has a pending shift swap request for this date',
      );
    }

    const record = await this.prisma.shiftSwapRequest.create({
      data: {
        orgId,
        branchId,
        requesterEmployeeId: dto.requesterEmployeeId,
        targetEmployeeId: dto.targetEmployeeId,
        shiftDate,
        reason: dto.reason,
      },
    });

    await this.audit.log({
      action: 'SHIFT_SWAP_CREATED',
      actorUserId: userId,
      entityType: 'ShiftSwapRequest',
      entityId: record.id,
      metadata: {
        requesterEmployeeId: dto.requesterEmployeeId,
        targetEmployeeId: dto.targetEmployeeId,
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }

  async listShiftSwaps(
    ctx: { branchId: string; organizationId: string },
    query: ListShiftSwapsQueryDto,
    actorUserId?: string,
  ) {
    const { organizationId: orgId, branchId } = ctx;
    const where: Prisma.ShiftSwapRequestWhereInput = { orgId, branchId };

    if (query.mine) {
      const mineId = await this.resolveMineEmployeeId(actorUserId);
      if (!mineId) return { data: [], total: 0 };
      where.OR = [
        { requesterEmployeeId: mineId },
        { targetEmployeeId: mineId },
      ];
    } else if (query.employeeId) {
      where.OR = [
        { requesterEmployeeId: query.employeeId },
        { targetEmployeeId: query.employeeId },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.shiftSwapRequest.findMany({
        where,
        include: { requester: true, target: true, approvedBy: true },
        orderBy: { createdAt: 'desc' },
        skip: Number(query.skip) || 0,
        take: Math.min(Number(query.take) || 50, MAX_LEAVE_PAGE_SIZE),
      }),
      this.prisma.shiftSwapRequest.count({ where }),
    ]);

    return { data, total };
  }

  async approveShiftSwap(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    id: string,
    dto: ApproveShiftSwapDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    // Shift swaps are branch-scoped — the lookup is constrained to the caller's
    // branch so a Supervisor in one branch cannot decide another branch's swap
    // (same org). Previously this filtered by orgId only (cross-branch surface).
    const existing = await this.prisma.shiftSwapRequest.findFirst({
      where: { id, orgId, branchId },
    });
    if (!existing) {
      throw new NotFoundException(`Shift swap request "${id}" not found`);
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(
        `Shift swap request is already ${existing.status} and cannot be reviewed`,
      );
    }
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('Review status must be APPROVED or REJECTED');
    }

    // Concurrency-safe, branch-scoped claim (see reviewLeaveRequest for rationale).
    const approvedAt = new Date();
    const claim = await this.prisma.shiftSwapRequest.updateMany({
      where: { id, orgId, branchId, status: 'PENDING' },
      data: {
        status: dto.status,
        approvedById: userId,
        approvedAt,
        reviewNotes: dto.reviewNotes,
      },
    });
    if (claim.count === 0) {
      throw new ConflictException(
        'Shift swap request was concurrently modified and is no longer pending',
      );
    }
    const record = {
      ...existing,
      status: dto.status,
      approvedById: userId,
      approvedAt,
      reviewNotes: dto.reviewNotes ?? null,
    };

    await this.audit.log({
      action: `SHIFT_SWAP_${dto.status}`,
      actorUserId: userId,
      entityType: 'ShiftSwapRequest',
      entityId: record.id,
      metadata: {
        previousStatus: existing.status,
        newStatus: dto.status,
        orgId,
        branchId,
        ...auditMeta,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }

  // ── Attendance Policies ──

  async createAttendancePolicy(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateAttendancePolicyDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    const record = await this.prisma.attendancePolicy.create({
      data: {
        orgId,
        branchId,
        name: dto.name,
        graceMinutes: dto.graceMinutes ?? 0,
        autoLateAfterMinutes: dto.autoLateAfterMinutes,
        allowSelfClockOutFix: dto.allowSelfClockOutFix ?? false,
      },
    });

    await this.audit.log({
      action: 'ATTENDANCE_POLICY_CREATED',
      actorUserId: userId,
      entityType: 'AttendancePolicy',
      entityId: record.id,
      metadata: { name: dto.name, orgId, branchId, ...auditMeta },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }

  async listAttendancePolicies(ctx: { branchId: string; organizationId: string }) {
    const { organizationId: orgId, branchId } = ctx;
    return this.prisma.attendancePolicy.findMany({
      where: {
        orgId,
        OR: [{ branchId }, { branchId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAttendancePolicy(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    id: string,
    dto: UpdateAttendancePolicyDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const { organizationId: orgId, branchId } = ctx;

    const existing = await this.prisma.attendancePolicy.findFirst({
      where: { id, orgId },
    });
    if (!existing) {
      throw new NotFoundException(`Attendance policy "${id}" not found`);
    }

    const record = await this.prisma.attendancePolicy.update({
      where: { id },
      data: {
        name: dto.name,
        graceMinutes: dto.graceMinutes,
        autoLateAfterMinutes: dto.autoLateAfterMinutes,
        allowSelfClockOutFix: dto.allowSelfClockOutFix,
        active: dto.active,
      },
    });

    await this.audit.log({
      action: 'ATTENDANCE_POLICY_UPDATED',
      actorUserId: userId,
      entityType: 'AttendancePolicy',
      entityId: record.id,
      metadata: { policyName: existing.name, orgId, branchId, ...auditMeta },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return record;
  }
}
