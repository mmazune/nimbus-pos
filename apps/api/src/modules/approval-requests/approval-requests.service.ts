import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  ApprovalChannel,
  ApprovalKind,
  ApprovalLevel,
  ApprovalRequest,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { QuickPinService } from '../auth/quick-pin.service';
import { SAFE_USER_SELECT } from '../../common/projection/people';

/** Answer a request at supervisor level (supervisor, manager, owner). */
export const ANSWER_KEY = 'pos:approvals:answer';
/** Answer a request at manager level (manager, owner). */
export const ANSWER_MANAGER_KEY = 'pos:approvals:answer-manager';

export const MAX_PIN_TRIES_PER_REQUEST = 5;

type Tx = Prisma.TransactionClient;
type Ctx = { organizationId: string; branchId: string };

/** What happens to the thing that asked, when its request is answered. */
export interface ApprovalEffect {
  approve(tx: Tx, req: ApprovalRequest, approverId: string): Promise<void>;
  decline(tx: Tx, req: ApprovalRequest, approverId: string): Promise<void>;
}

export function mayAnswer(permissions: string[], level: ApprovalLevel): boolean {
  return level === ApprovalLevel.MANAGER
    ? permissions.includes(ANSWER_MANAGER_KEY)
    : permissions.includes(ANSWER_KEY) || permissions.includes(ANSWER_MANAGER_KEY);
}

/**
 * T6 — requests for approval (07-scenarios-and-rules.md, Sensitive actions; 04-alerts.md
 * APPROVAL_WAITING). A request is answered either by a supervisor typing their PIN on the
 * device that asked, or from Approvals. A supervisor-level request climbs after the venue's
 * wait: from then on managers are asked too. The climb is worked out when anyone reads or
 * answers (no queue), so it is exact to the minute it is next looked at.
 */
@Injectable()
export class ApprovalRequestsService {
  private readonly effects = new Map<ApprovalKind, ApprovalEffect>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quickPin: QuickPinService,
  ) {}

  registerEffect(kind: ApprovalKind, effect: ApprovalEffect) {
    this.effects.set(kind, effect);
  }

  async climbMinutes(orgId: string, tx: Tx | PrismaService = this.prisma): Promise<number> {
    const s = await tx.orgSettings.findUnique({
      where: { orgId },
      select: { approvalClimbMinutes: true },
    });
    return s?.approvalClimbMinutes ?? 3;
  }

  /** Made by the engine that needs the answer (refund, till), inside its own transaction. */
  async open(
    tx: Tx,
    ctx: Ctx,
    args: {
      kind: ApprovalKind;
      level: ApprovalLevel;
      subjectType: string;
      subjectId: string;
      summary: string;
      amount?: Prisma.Decimal | string | null;
      payload?: Prisma.InputJsonValue;
      requestedById: string;
    },
  ) {
    const now = new Date();
    const minutes = await this.climbMinutes(ctx.organizationId, tx);
    return tx.approvalRequest.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        kind: args.kind,
        level: args.level,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        summary: args.summary,
        amount: args.amount ?? null,
        payload: args.payload ?? Prisma.JsonNull,
        requestedById: args.requestedById,
        requestedAt: now,
        // A manager-level request has nowhere higher to climb.
        climbsAt:
          args.level === ApprovalLevel.SUPERVISOR
            ? new Date(now.getTime() + minutes * 60_000)
            : null,
      },
    });
  }

  /** Marks every due request as climbed. Safe to call any time; idempotent. */
  async sweepClimbs(ctx: Ctx, now = new Date()) {
    const due = await this.prisma.approvalRequest.findMany({
      where: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        status: 'PENDING',
        climbedAt: null,
        climbsAt: { lte: now },
      },
      select: { id: true },
    });
    for (const r of due) {
      const done = await this.prisma.approvalRequest.updateMany({
        where: { id: r.id, climbedAt: null, status: 'PENDING' },
        data: { climbedAt: now },
      });
      if (done.count === 1) {
        await this.audit.log({
          actorUserId: null,
          action: 'APPROVAL_CLIMBED',
          entityType: 'ApprovalRequest',
          entityId: r.id,
          metadata: { branchId: ctx.branchId, climbedAt: now.toISOString(), to: 'MANAGER' },
        });
      }
    }
    return due.length;
  }

  private shape(
    r: ApprovalRequest & { requestedBy?: unknown; decidedBy?: unknown },
    now = new Date(),
  ) {
    const askedOf: string[] = r.level === 'MANAGER' ? ['Manager'] : ['Supervisor'];
    if (r.level === 'SUPERVISOR' && r.climbedAt) askedOf.push('Manager');
    return {
      ...r,
      askedOf,
      waitingSeconds: Math.max(0, Math.floor((now.getTime() - r.requestedAt.getTime()) / 1000)),
    };
  }

  /**
   * `waiting` (default): what this person may answer now. A supervisor sees supervisor-level
   * requests; a manager sees manager-level ones and every supervisor-level one that has
   * climbed. `mine`: what this person asked. `all`: every request in the branch, for anyone
   * who may answer at either level.
   */
  async list(
    ctx: Ctx,
    user: { id: string; permissions: string[] },
    scope: 'waiting' | 'mine' | 'all' = 'waiting',
  ) {
    await this.sweepClimbs(ctx);
    const base: Prisma.ApprovalRequestWhereInput = {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
    };
    let where: Prisma.ApprovalRequestWhereInput;
    const canSup = mayAnswer(user.permissions, 'SUPERVISOR');
    const canMgr = mayAnswer(user.permissions, 'MANAGER');
    if (scope === 'mine') {
      where = { ...base, requestedById: user.id };
    } else if (scope === 'all') {
      if (!canSup) throw new ForbiddenException('Only someone who answers requests sees them all');
      where = base;
    } else {
      const or: Prisma.ApprovalRequestWhereInput[] = [];
      if (canMgr) {
        or.push({ level: 'MANAGER' }, { level: 'SUPERVISOR', climbedAt: { not: null } });
      }
      if (canSup && !user.permissions.includes(ANSWER_MANAGER_KEY))
        or.push({ level: 'SUPERVISOR' });
      if (or.length === 0) return { data: [], total: 0 };
      where = { ...base, status: 'PENDING', OR: or, NOT: { requestedById: user.id } };
    }
    const rows = await this.prisma.approvalRequest.findMany({
      where,
      orderBy: { requestedAt: 'asc' },
      take: 100,
    });
    const now = new Date();
    return { data: rows.map((r) => this.shape(r, now)), total: rows.length };
  }

  async get(ctx: Ctx, id: string) {
    await this.sweepClimbs(ctx);
    const r = await this.prisma.approvalRequest.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!r) throw new NotFoundException('Request not found');
    const [requestedBy, decidedBy] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: r.requestedById }, select: SAFE_USER_SELECT }),
      r.decidedById
        ? this.prisma.user.findUnique({ where: { id: r.decidedById }, select: SAFE_USER_SELECT })
        : null,
    ]);
    return { ...this.shape(r), requestedBy, decidedBy };
  }

  /** From Approvals: the signed-in approver answers. */
  async decide(
    ctx: Ctx,
    approver: { id: string; permissions: string[] },
    id: string,
    decision: 'APPROVE' | 'DECLINE',
    note?: string,
  ) {
    return this.answer(ctx, id, approver.id, approver.permissions, decision, 'APPROVALS', note);
  }

  /**
   * On the device that asked: the requester's session sends a supervisor's (or, for a
   * manager-level request, a manager's) PIN. The PIN is matched in this branch like a PIN
   * sign-in; it is never stored, logged or returned. Five wrong PINs close this door for the
   * request (Approvals still works).
   */
  async answerWithPin(
    ctx: Ctx,
    requester: { id: string },
    id: string,
    pin: string,
    decision: 'APPROVE' | 'DECLINE',
    note?: string,
  ) {
    const req = await this.prisma.approvalRequest.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.requestedById !== requester.id) {
      // Only the device that asked can be handed over; anyone else answers from Approvals.
      throw new ForbiddenException('Only the person who asked can take a PIN for this request');
    }
    if (req.status !== 'PENDING') throw new ConflictException(`Request is ${req.status}`);
    const tries = Number((req.payload as any)?.pinTries ?? 0);
    if (tries >= MAX_PIN_TRIES_PER_REQUEST) {
      throw new HttpException(
        { code: 'PIN_TRIES_USED', message: 'Too many wrong PINs; answer it from Approvals' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const approver = await this.prisma.user.findUnique({
      where: { pinLookupHash: this.quickPin.derivePinLookupHash(ctx.branchId, String(pin)) },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
        memberships: { where: { branchId: ctx.branchId, status: 'ACTIVE' }, select: { id: true } },
      },
    });
    const pinOk =
      !!approver &&
      approver.isActive &&
      approver.quickPinEnabled &&
      !!approver.quickPinHash &&
      approver.memberships.length > 0 &&
      !(approver.pinLockedUntil && approver.pinLockedUntil > new Date()) &&
      (await bcrypt.compare(String(pin), approver.quickPinHash));
    if (!pinOk) {
      await this.prisma.approvalRequest.update({
        where: { id: req.id },
        data: { payload: { ...((req.payload as object) ?? {}), pinTries: tries + 1 } },
      });
      await this.audit.log({
        actorUserId: requester.id,
        action: 'APPROVAL_PIN_REFUSED',
        entityType: 'ApprovalRequest',
        entityId: req.id,
        metadata: { branchId: ctx.branchId, tries: tries + 1 },
      });
      throw new UnauthorizedException({
        code: 'PIN_NOT_RECOGNISED',
        message: 'PIN not recognised',
      });
    }
    const perms = [
      ...new Set(
        approver!.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.action),
        ),
      ),
    ];
    return this.answer(ctx, id, approver!.id, perms, decision, 'PIN_ON_DEVICE', note);
  }

  private async answer(
    ctx: Ctx,
    id: string,
    approverId: string,
    permissions: string[],
    decision: 'APPROVE' | 'DECLINE',
    via: ApprovalChannel,
    note?: string,
  ) {
    if (decision !== 'APPROVE' && decision !== 'DECLINE') {
      throw new BadRequestException('decision must be APPROVE or DECLINE');
    }
    await this.sweepClimbs(ctx);
    const req = await this.prisma.approvalRequest.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'PENDING') throw new ConflictException(`Request is ${req.status}`);
    if (req.requestedById === approverId) {
      throw new ForbiddenException({
        code: 'OWN_REQUEST',
        message: 'Someone else answers your request',
      });
    }
    if (!mayAnswer(permissions, req.level)) {
      throw new ForbiddenException({
        code: req.level === 'MANAGER' ? 'NEEDS_MANAGER' : 'NEEDS_SUPERVISOR',
        message:
          req.level === 'MANAGER' ? 'A manager answers this one' : 'A supervisor answers this one',
      });
    }
    const effect = this.effects.get(req.kind);
    if (!effect) throw new ConflictException(`No engine answers ${req.kind} requests`);

    const now = new Date();
    const status = decision === 'APPROVE' ? 'APPROVED' : 'DECLINED';
    const done = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.approvalRequest.updateMany({
        where: { id: req.id, status: 'PENDING' },
        data: {
          status,
          decidedById: approverId,
          decidedAt: now,
          decidedVia: via,
          decisionNote: note ?? null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Request already answered');
      const fresh = await tx.approvalRequest.findUniqueOrThrow({ where: { id: req.id } });
      if (decision === 'APPROVE') await effect.approve(tx, fresh, approverId);
      else await effect.decline(tx, fresh, approverId);
      return fresh;
    });

    await this.audit.log({
      actorUserId: approverId,
      action: decision === 'APPROVE' ? 'APPROVAL_GRANTED' : 'APPROVAL_DECLINED',
      entityType: 'ApprovalRequest',
      entityId: req.id,
      metadata: {
        branchId: ctx.branchId,
        kind: req.kind,
        subjectType: req.subjectType,
        subjectId: req.subjectId,
        via,
        climbed: !!req.climbedAt,
        requestedById: req.requestedById,
      },
    });
    return this.shape(done);
  }
}
