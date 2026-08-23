import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { PasswordLifecycleService } from '../auth/password-lifecycle.service';
import { FrontlineStaffOnboardingService } from './frontline-staff-onboarding.service';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * B6.7 — Manager-facing credential reset over the employee detail panel.
 * See docs/manager-settings-docs/CREDENTIAL_RESET.md for the full design.
 *
 * Sits on top of PasswordLifecycleService the same way
 * FrontlineStaffQuickPinService sits on top of QuickPinService: resolves
 * Employee -> User with the B3-F1 branch guard (cross-branch/missing employee
 * -> 404, never a 403 that would confirm the id exists elsewhere), then
 * delegates the actual token/session/audit work.
 *
 * PIN-only staff (no real password login — synthetic email) are rejected with
 * a 400 naming Quick-PIN reset as the correct tool. This feature never touches
 * Quick-PIN.
 */
@Injectable()
export class EmployeeCredentialResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordLifecycle: PasswordLifecycleService,
  ) {}

  private async loadEmployeeForBranch(
    employeeId: string,
    ctx: { organizationId: string; branchId: string },
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (
      !employee ||
      employee.orgId !== ctx.organizationId ||
      !employee.branchId ||
      employee.branchId !== ctx.branchId
    ) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.userId) {
      throw new BadRequestException(
        'Employee has no linked User account; there is no credential to reset',
      );
    }
    return employee;
  }

  private async assertPasswordLoginAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('Staff member not found or inactive');
    }
    const hasPasswordLogin = !FrontlineStaffOnboardingService.isSyntheticEmail(user.email);
    if (!hasPasswordLogin) {
      throw new BadRequestException(
        'This staff member has no password login (PIN-only account) — use Quick-PIN reset instead',
      );
    }
    return user;
  }

  async trigger(
    actorUserId: string,
    ctx: { organizationId: string; branchId: string },
    employeeId: string,
    meta: RequestMeta = {},
  ) {
    const employee = await this.loadEmployeeForBranch(employeeId, ctx);
    await this.assertPasswordLoginAccount(employee.userId!);

    return this.passwordLifecycle.adminForceReset(
      employee.userId!,
      { id: actorUserId, branchId: ctx.branchId },
      { ...meta, employeeId: employee.id },
    );
  }

  async getStatus(ctx: { organizationId: string; branchId: string }, employeeId: string) {
    const employee = await this.loadEmployeeForBranch(employeeId, ctx);
    await this.assertPasswordLoginAccount(employee.userId!);
    return this.passwordLifecycle.getForceResetStatus(employee.userId!);
  }
}
