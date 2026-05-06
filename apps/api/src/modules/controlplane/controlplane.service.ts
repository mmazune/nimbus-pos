import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceWindowService } from './maintenance-window.service';
import { TrainingSessionService } from './training-session.service';
import { FlagAuditService } from './flag-audit.service';
import { WriteBlockCategoryT } from './dto';

export interface AssertWriteAllowedInput {
    orgId: string;
    branchId?: string | null;
    actorUserId?: string | null;
    category: WriteBlockCategoryT;
    operation: string;
}

export interface TrainingShortCircuit {
    inTraining: true;
    sessionId: string;
    mode: string;
    label: string;
    simulated: true;
    operation: string;
    receivedAt: string;
    note: string;
}

/**
 * Facade exposed to other domain modules (inventory, billing, …) so they
 * never need to reach into the M42 services directly.
 *
 * Locked rules:
 *   - `assertWriteAllowed` throws `409 Conflict` when an ACTIVE
 *     BLOCK_WRITES maintenance window currently covers the operation's
 *     category. The block is recorded via `FlagAuditService` so any blocked
 *     attempt is auditable.
 *   - `checkTrainingMode` returns a non-null short-circuit object when the
 *     caller supplied a header-bound active TrainingSession id. Callers
 *     MUST NOT persist real domain rows when this object is returned.
 */
@Injectable()
export class ControlPlaneService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly maintenance: MaintenanceWindowService,
        private readonly training: TrainingSessionService,
        private readonly audit: FlagAuditService,
    ) { }

    async assertWriteAllowed(input: AssertWriteAllowedInput): Promise<void> {
        const blocking = await this.maintenance.findBlockingWindow(
            input.orgId,
            input.branchId ?? null,
            input.category,
        );
        if (!blocking) return;

        await this.audit.log({
            orgId: input.orgId,
            action: 'WRITE_BLOCKED_BY_MAINTENANCE',
            maintenanceWindowId: blocking.id,
            actorUserId: input.actorUserId ?? null,
            metadata: {
                category: input.category,
                operation: input.operation,
                branchId: input.branchId ?? null,
                windowCode: blocking.code,
            },
        });

        throw new ConflictException({
            message:
                `Write blocked by active maintenance window '${blocking.code}'. ` +
                `Try again after ${blocking.endsAt.toISOString()}.`,
            code: 'MAINTENANCE_WINDOW_ACTIVE',
            windowId: blocking.id,
            windowCode: blocking.code,
            endsAt: blocking.endsAt.toISOString(),
            blockedCategory: input.category,
        });
    }

    async checkTrainingMode(
        orgId: string,
        actorUserId: string,
        sessionId: string | null | undefined,
        operation: string,
    ): Promise<TrainingShortCircuit | null> {
        const session = await this.training.findActiveForActor(orgId, actorUserId, sessionId);
        if (!session) return null;

        await this.audit.log({
            orgId,
            action: 'REAL_POST_BLOCKED_BY_TRAINING',
            trainingSessionId: session.id,
            actorUserId,
            metadata: { operation, mode: session.mode, label: session.label },
        });

        return {
            inTraining: true,
            sessionId: session.id,
            mode: session.mode,
            label: session.label,
            simulated: true,
            operation,
            receivedAt: new Date().toISOString(),
            note:
                'Training mode is active for this actor. The real domain write was ' +
                'short-circuited and no production rows were persisted.',
        };
    }
}
