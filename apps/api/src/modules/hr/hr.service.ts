import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ListEmployeesQueryDto,
  CreateContractDto,
  ListContractsQueryDto,
  CreatePositionDto,
  CreateCompensationProfileDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Employee Code Generation ──

  private async generateEmployeeCode(orgId: string): Promise<string> {
    const count = await this.prisma.employee.count({ where: { orgId } });
    return `EMP-${String(count + 1).padStart(5, '0')}`;
  }

  // ── Contract Number Generation ──

  private async generateContractNumber(orgId: string): Promise<string> {
    const count = await this.prisma.employmentContract.count({ where: { orgId } });
    return `CTR-${String(count + 1).padStart(5, '0')}`;
  }

  // ── Employees ──

  async createEmployee(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateEmployeeDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const orgId = ctx.organizationId;
    const branchId = ctx.branchId;

    // Generate employee code if not provided
    const employeeCode = dto.employeeCode || (await this.generateEmployeeCode(orgId));

    // Check duplicate employeeCode
    const existing = await this.prisma.employee.findUnique({
      where: { orgId_employeeCode: { orgId, employeeCode } },
    });
    if (existing) {
      throw new ConflictException(
        `Employee code "${employeeCode}" already exists in this organization`,
      );
    }

    // Validate userId if provided
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user) {
        throw new BadRequestException(`User "${dto.userId}" not found`);
      }
      // Check if another employee already linked to this user
      const linkedEmployee = await this.prisma.employee.findUnique({
        where: { userId: dto.userId },
      });
      if (linkedEmployee) {
        throw new ConflictException(
          `User "${dto.userId}" is already linked to employee "${linkedEmployee.employeeCode}"`,
        );
      }
    }

    // Validate positionId if provided
    if (dto.positionId) {
      const position = await this.prisma.position.findUnique({ where: { id: dto.positionId } });
      if (!position || position.orgId !== orgId) {
        throw new BadRequestException(
          `Position "${dto.positionId}" not found in this organization`,
        );
      }
    }

    // Validate compensationProfileId if provided
    if (dto.compensationProfileId) {
      const profile = await this.prisma.compensationProfile.findUnique({
        where: { id: dto.compensationProfileId },
      });
      if (!profile || profile.orgId !== orgId) {
        throw new BadRequestException(
          `Compensation profile "${dto.compensationProfileId}" not found in this organization`,
        );
      }
    }

    const employee = await this.prisma.employee.create({
      data: {
        orgId,
        branchId,
        userId: dto.userId || null,
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        phone: dto.phone,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        hireDate: new Date(dto.hireDate),
        status: dto.status || 'ACTIVE',
        employmentType: dto.employmentType,
        positionId: dto.positionId || null,
        compensationProfileId: dto.compensationProfileId || null,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        address: dto.address || Prisma.JsonNull,
        notes: dto.notes,
        metadata: dto.metadata || Prisma.JsonNull,
      },
      include: { position: true, compensationProfile: true },
    });

    await this.audit.log({
      action: 'EMPLOYEE_CREATED',
      actorUserId: userId,
      entityType: 'Employee',
      entityId: employee.id,
      metadata: {
        employeeCode: employee.employeeCode,
        employmentType: employee.employmentType,
        hasUserId: !!employee.userId,
        ...auditMeta,
      },
    });

    return employee;
  }

  async updateEmployee(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    employeeId: string,
    dto: UpdateEmployeeDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const orgId = ctx.organizationId;

    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.orgId !== orgId) {
      throw new NotFoundException(`Employee "${employeeId}" not found`);
    }

    // Validate positionId if provided
    if (dto.positionId) {
      const position = await this.prisma.position.findUnique({ where: { id: dto.positionId } });
      if (!position || position.orgId !== orgId) {
        throw new BadRequestException(
          `Position "${dto.positionId}" not found in this organization`,
        );
      }
    }

    // Validate compensationProfileId if provided
    if (dto.compensationProfileId) {
      const profile = await this.prisma.compensationProfile.findUnique({
        where: { id: dto.compensationProfileId },
      });
      if (!profile || profile.orgId !== orgId) {
        throw new BadRequestException(
          `Compensation profile "${dto.compensationProfileId}" not found in this organization`,
        );
      }
    }

    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.middleName !== undefined) data.middleName = dto.middleName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.dateOfBirth !== undefined)
      data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.employmentType !== undefined) data.employmentType = dto.employmentType;
    if (dto.positionId !== undefined) data.positionId = dto.positionId || null;
    if (dto.compensationProfileId !== undefined)
      data.compensationProfileId = dto.compensationProfileId || null;
    if (dto.emergencyContactName !== undefined)
      data.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined)
      data.emergencyContactPhone = dto.emergencyContactPhone;
    if (dto.address !== undefined) data.address = dto.address || Prisma.JsonNull;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.metadata !== undefined) data.metadata = dto.metadata || Prisma.JsonNull;

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data,
      include: { position: true, compensationProfile: true },
    });

    await this.audit.log({
      action: 'EMPLOYEE_UPDATED',
      actorUserId: userId,
      entityType: 'Employee',
      entityId: updated.id,
      metadata: {
        updatedFields: Object.keys(data),
        statusChange:
          dto.status && dto.status !== employee.status
            ? { from: employee.status, to: dto.status }
            : undefined,
        ...auditMeta,
      },
    });

    return updated;
  }

  async listEmployees(
    ctx: { branchId: string; organizationId: string },
    query: ListEmployeesQueryDto,
  ) {
    const orgId = ctx.organizationId;
    const where: any = { orgId };

    if (query.status) where.status = query.status;
    if (query.employmentType) where.employmentType = query.employmentType;
    if (query.positionId) where.positionId = query.positionId;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = query.skip ? Number(query.skip) : 0;
    const take = query.take ? Number(query.take) : 50;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: { position: true, compensationProfile: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getEmployee(ctx: { branchId: string; organizationId: string }, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        position: true,
        compensationProfile: true,
        contracts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!employee || employee.orgId !== ctx.organizationId) {
      throw new NotFoundException(`Employee "${employeeId}" not found`);
    }
    return employee;
  }

  // ── Contracts ──

  async createContract(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateContractDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const orgId = ctx.organizationId;

    // Validate employee
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.orgId !== orgId) {
      throw new BadRequestException(`Employee "${dto.employeeId}" not found in this organization`);
    }

    // Generate contract number if not provided
    const contractNumber = dto.contractNumber || (await this.generateContractNumber(orgId));

    // Check duplicate contractNumber
    const existing = await this.prisma.employmentContract.findUnique({
      where: { orgId_contractNumber: { orgId, contractNumber } },
    });
    if (existing) {
      throw new ConflictException(
        `Contract number "${contractNumber}" already exists in this organization`,
      );
    }

    const contract = await this.prisma.employmentContract.create({
      data: {
        orgId,
        branchId: ctx.branchId,
        employeeId: dto.employeeId,
        contractNumber,
        contractStatus: dto.contractStatus || 'DRAFT',
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        salaryBasis: dto.salaryBasis,
        salaryAmount: dto.salaryAmount ?? null,
        termsSummary: dto.termsSummary,
        createdById: userId,
        metadata: dto.metadata || Prisma.JsonNull,
      },
      include: { employee: true },
    });

    await this.audit.log({
      action: 'CONTRACT_CREATED',
      actorUserId: userId,
      entityType: 'EmploymentContract',
      entityId: contract.id,
      metadata: {
        contractNumber: contract.contractNumber,
        employeeId: contract.employeeId,
        salaryBasis: contract.salaryBasis,
        ...auditMeta,
      },
    });

    return contract;
  }

  async listContracts(
    ctx: { branchId: string; organizationId: string },
    query: ListContractsQueryDto,
  ) {
    const orgId = ctx.organizationId;
    const where: any = { orgId };

    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.contractStatus) where.contractStatus = query.contractStatus;
    if (query.salaryBasis) where.salaryBasis = query.salaryBasis;

    const skip = query.skip ? Number(query.skip) : 0;
    const take = query.take ? Number(query.take) : 50;

    const [data, total] = await Promise.all([
      this.prisma.employmentContract.findMany({
        where,
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.employmentContract.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  // ── Positions ──

  async createPosition(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreatePositionDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const orgId = ctx.organizationId;

    // Check duplicate code
    const existing = await this.prisma.position.findUnique({
      where: { orgId_code: { orgId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(
        `Position code "${dto.code}" already exists in this organization`,
      );
    }

    const position = await this.prisma.position.create({
      data: {
        orgId,
        branchId: ctx.branchId,
        code: dto.code,
        title: dto.title,
        department: dto.department,
        level: dto.level,
        description: dto.description,
        active: dto.active ?? true,
      },
    });

    await this.audit.log({
      action: 'POSITION_CREATED',
      actorUserId: userId,
      entityType: 'Position',
      entityId: position.id,
      metadata: { code: position.code, title: position.title, ...auditMeta },
    });

    return position;
  }

  async listPositions(ctx: { branchId: string; organizationId: string }) {
    return this.prisma.position.findMany({
      where: { orgId: ctx.organizationId },
      orderBy: { title: 'asc' },
    });
  }

  // ── Compensation Profiles ──

  async createCompensationProfile(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateCompensationProfileDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const orgId = ctx.organizationId;

    // Check duplicate code
    const existing = await this.prisma.compensationProfile.findUnique({
      where: { orgId_code: { orgId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(
        `Compensation profile code "${dto.code}" already exists in this organization`,
      );
    }

    const profile = await this.prisma.compensationProfile.create({
      data: {
        orgId,
        branchId: ctx.branchId,
        code: dto.code,
        salaryBasis: dto.salaryBasis,
        baseAmount: dto.baseAmount ?? null,
        currency: dto.currency,
        allowances: dto.allowances || Prisma.JsonNull,
        deductions: dto.deductions || Prisma.JsonNull,
        notes: dto.notes,
        active: dto.active ?? true,
      },
    });

    await this.audit.log({
      action: 'COMPENSATION_PROFILE_CREATED',
      actorUserId: userId,
      entityType: 'CompensationProfile',
      entityId: profile.id,
      metadata: {
        code: profile.code,
        salaryBasis: profile.salaryBasis,
        ...auditMeta,
      },
    });

    return profile;
  }

  async listCompensationProfiles(ctx: { branchId: string; organizationId: string }) {
    return this.prisma.compensationProfile.findMany({
      where: { orgId: ctx.organizationId },
      orderBy: { code: 'asc' },
    });
  }
}
