import {
    Injectable,
    BadRequestException,
    UnauthorizedException,
    NotFoundException,
    ConflictException,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { ForgotPasswordDto, ResetPasswordDto, ForcePasswordChangeDto } from './dto';

/**
 * BG1 — Password lifecycle.
 *  - forgotPassword (public)  → issues a single-use reset token
 *  - resetPassword (public)   → consumes a reset token + sets new password
 *  - forcePasswordChange (auth) → for must_change_password=true users on first login
 *
 * B6.7 — adminForceReset / getForceResetStatus (auth) → Manager/Owner-triggered
 * credential reset. See docs/manager-settings-docs/CREDENTIAL_RESET.md for the
 * full design rationale (reuse of PasswordResetToken/FORCE_RESET_BY_ADMIN, the
 * delivery-channel gap, rate limits, session-invalidation timing).
 */
@Injectable()
export class PasswordLifecycleService {
    private readonly SALT_ROUNDS = 12;
    private readonly RESET_TTL_MINUTES = 60;
    private readonly FORCE_RESET_TTL_MINUTES = 30;
    private readonly FORCE_RESET_SUBJECT_LIMIT = 3;
    private readonly FORCE_RESET_SUBJECT_WINDOW_MS = 60 * 60 * 1000;
    private readonly FORCE_RESET_ACTOR_LIMIT = 20;
    private readonly FORCE_RESET_ACTOR_WINDOW_MS = 60 * 60 * 1000;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    private hashToken(plaintext: string): string {
        return crypto.createHash('sha256').update(plaintext).digest('hex');
    }

    /**
     * POST /api/auth/forgot-password
     * Always returns 200 with the same shape regardless of whether the email
     * resolves — prevents account enumeration. The reset token is returned
     * inline ONLY in non-production for now (no email transport wired yet),
     * gated by NIMBUS_EXPOSE_RESET_TOKENS=true.
     */
    async forgotPassword(
        dto: ForgotPasswordDto,
        meta: { ipAddress?: string; userAgent?: string } = {},
    ) {
        const email = dto.email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({ where: { email } });

        // Generic response — never disclose user existence
        const generic = {
            ok: true,
            message:
                'If an account exists for that email, a password reset link has been issued.',
        };

        if (!user || !user.isActive) {
            // C-28-EXEMPT: PASSWORD_RESET_REQUESTED_UNKNOWN — User model has no branch_id column; no membership loaded.
            await this.audit.log({
                action: 'PASSWORD_RESET_REQUESTED_UNKNOWN',
                entityType: 'auth',
                metadata: { email, reason: 'user_not_found_or_inactive' },
                ipAddress: meta.ipAddress,
                userAgent: meta.userAgent,
            });
            return generic;
        }

        // Invalidate any previous unconsumed FORGOT_PASSWORD tokens
        await this.prisma.passwordResetToken.updateMany({
            where: {
                userId: user.id,
                purpose: 'FORGOT_PASSWORD',
                consumedAt: null,
                invalidatedAt: null,
            },
            data: { invalidatedAt: new Date() },
        });

        const plaintext = `prt_${crypto.randomBytes(24).toString('hex')}`;
        const tokenHash = this.hashToken(plaintext);
        const expiresAt = new Date(Date.now() + this.RESET_TTL_MINUTES * 60 * 1000);

        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                purpose: 'FORGOT_PASSWORD',
                expiresAt,
                ipAddress: meta.ipAddress ?? null,
                userAgent: meta.userAgent ?? null,
            },
        });

        // C-28-EXEMPT: PASSWORD_RESET_REQUESTED — same reason.
        await this.audit.log({
            actorUserId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            metadata: { email },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        const exposeForDev =
            process.env.NIMBUS_EXPOSE_RESET_TOKENS === 'true' ||
            process.env.NODE_ENV !== 'production';

        return {
            ...generic,
            ...(exposeForDev
                ? { resetToken: plaintext, expiresAt, _devOnly: true }
                : {}),
        };
    }

    /**
     * POST /api/auth/reset-password
     * Public — consumes a single-use token issued by forgotPassword OR by an
     * admin via force-reset (purpose=FORCE_RESET_BY_ADMIN).
     */
    async resetPassword(
        dto: ResetPasswordDto,
        meta: { ipAddress?: string; userAgent?: string } = {},
    ) {
        const tokenHash = this.hashToken(dto.resetToken);
        const record = await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
        });

        if (!record) {
            throw new NotFoundException('Reset token not found');
        }
        if (record.consumedAt) {
            throw new ConflictException('Reset token already used');
        }
        if (record.invalidatedAt) {
            throw new ConflictException('Reset token has been invalidated');
        }
        if (record.expiresAt < new Date()) {
            throw new ConflictException('Reset token has expired');
        }

        const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
        if (!user || !user.isActive) {
            throw new UnauthorizedException('User inactive or missing');
        }

        const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash, mustChangePassword: false },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: record.id },
                data: { consumedAt: new Date() },
            }),
            // Defensive: revoke all active sessions so old tokens can't survive
            this.prisma.session.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
            this.prisma.refreshToken.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);

        // C-28-EXEMPT: PASSWORD_RESET_COMPLETED — same reason.
        await this.audit.log({
            actorUserId: user.id,
            action: 'PASSWORD_RESET_COMPLETED',
            entityType: 'User',
            entityId: user.id,
            metadata: { purpose: record.purpose },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return {
            ok: true,
            userId: user.id,
            email: user.email,
            nextStep: 'login',
        };
    }

    /**
     * POST /api/auth/force-password-change
     * For users flagged mustChangePassword=true (e.g. by an admin) who can
     * still log in but must rotate before continuing.
     */
    async forcePasswordChange(
        userId: string,
        dto: ForcePasswordChangeDto,
        meta: { ipAddress?: string; userAgent?: string } = {},
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive) {
            throw new UnauthorizedException('User inactive or missing');
        }

        const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!ok) {
            // C-28-EXEMPT: FORCE_PASSWORD_CHANGE_FAILED — same reason.
            await this.audit.log({
                actorUserId: user.id,
                action: 'FORCE_PASSWORD_CHANGE_FAILED',
                entityType: 'User',
                entityId: user.id,
                metadata: { reason: 'invalid_current_password' },
                ipAddress: meta.ipAddress,
                userAgent: meta.userAgent,
            });
            throw new UnauthorizedException('Current password is invalid');
        }

        if (dto.currentPassword === dto.newPassword) {
            throw new BadRequestException('New password must differ from current password');
        }

        const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustChangePassword: false },
        });

        // C-28-EXEMPT: FORCE_PASSWORD_CHANGE_COMPLETED — same reason.
        await this.audit.log({
            actorUserId: user.id,
            action: 'FORCE_PASSWORD_CHANGE_COMPLETED',
            entityType: 'User',
            entityId: user.id,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return { ok: true, userId: user.id, mustChangePassword: false };
    }

    /**
     * B6.7 — Manager/Owner-triggered credential reset (CREDENTIAL_RESET.md).
     *
     * Generates a single-use PasswordResetToken (purpose=FORCE_RESET_BY_ADMIN,
     * 30-minute TTL), invalidates any previous live token for the same subject,
     * immediately revokes the subject's active sessions/refresh tokens (defense
     * against a suspected-compromised live session — consume() revokes them again
     * as defense-in-depth), and rate-limits per subject and per actor.
     *
     * The plaintext token is NEVER included in the return value in production —
     * `_devOnlyDeliveryPreview` exists only when NIMBUS_EXPOSE_RESET_TOKENS=true
     * AND NODE_ENV !== 'production', mirroring forgotPassword()'s own dev-only
     * echo. There is no email/SMS transport in this codebase (disclosed gap,
     * see CREDENTIAL_RESET.md §4) — this is the only place the plaintext can be
     * observed at all, and only for QA tooling, never for the Manager UI.
     */
    async adminForceReset(
        subjectUserId: string,
        actor: { id: string; branchId?: string | null },
        meta: { ipAddress?: string; userAgent?: string; employeeId?: string } = {},
    ): Promise<{
        ok: true;
        userId: string;
        expiresAt: Date;
        _devOnlyDeliveryPreview?: string;
    }> {
        const subject = await this.prisma.user.findUnique({ where: { id: subjectUserId } });
        if (!subject || !subject.isActive) {
            throw new NotFoundException('Staff member not found or inactive');
        }

        const now = new Date();
        const subjectWindowStart = new Date(now.getTime() - this.FORCE_RESET_SUBJECT_WINDOW_MS);
        const actorWindowStart = new Date(now.getTime() - this.FORCE_RESET_ACTOR_WINDOW_MS);

        const subjectCount = await this.prisma.passwordResetToken.count({
            where: {
                userId: subjectUserId,
                purpose: 'FORCE_RESET_BY_ADMIN',
                createdAt: { gte: subjectWindowStart },
            },
        });
        if (subjectCount >= this.FORCE_RESET_SUBJECT_LIMIT) {
            await this.auditRateLimited(actor, subjectUserId, meta, 'subject');
            throw new HttpException(
                'Too many resets requested for this staff member — try again later',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        const actorCount = await this.prisma.passwordResetToken.count({
            where: {
                purpose: 'FORCE_RESET_BY_ADMIN',
                createdAt: { gte: actorWindowStart },
                metadata: { path: ['triggeredByUserId'], equals: actor.id },
            },
        });
        if (actorCount >= this.FORCE_RESET_ACTOR_LIMIT) {
            await this.auditRateLimited(actor, subjectUserId, meta, 'actor');
            throw new HttpException(
                'Too many resets triggered by this account — try again later',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // Invalidate any previous unconsumed FORCE_RESET_BY_ADMIN token for this subject.
        await this.prisma.passwordResetToken.updateMany({
            where: {
                userId: subjectUserId,
                purpose: 'FORCE_RESET_BY_ADMIN',
                consumedAt: null,
                invalidatedAt: null,
            },
            data: { invalidatedAt: now },
        });

        const plaintext = `far_${crypto.randomBytes(24).toString('hex')}`;
        const tokenHash = this.hashToken(plaintext);
        const expiresAt = new Date(now.getTime() + this.FORCE_RESET_TTL_MINUTES * 60 * 1000);

        await this.prisma.passwordResetToken.create({
            data: {
                userId: subjectUserId,
                tokenHash,
                purpose: 'FORCE_RESET_BY_ADMIN',
                expiresAt,
                ipAddress: meta.ipAddress ?? null,
                userAgent: meta.userAgent ?? null,
                metadata: {
                    triggeredByUserId: actor.id,
                    triggeredByBranchId: actor.branchId ?? null,
                },
            },
        });

        // Immediate session kill — defense against a suspected-compromised live
        // session (resetPassword() repeats this at consume time; see
        // CREDENTIAL_RESET.md §6 for the disclosed old-password-still-works caveat).
        await this.prisma.session.updateMany({
            where: { userId: subjectUserId, revokedAt: null },
            data: { revokedAt: now },
        });
        await this.prisma.refreshToken.updateMany({
            where: { userId: subjectUserId, revokedAt: null },
            data: { revokedAt: now },
        });

        await this.audit.log({
            actorUserId: actor.id,
            action: 'CREDENTIAL_RESET_TRIGGERED',
            entityType: 'User',
            entityId: subjectUserId,
            metadata: {
                employeeId: meta.employeeId ?? null,
                branchId: actor.branchId ?? null,
                expiresAt: expiresAt.toISOString(),
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        const exposeForDev =
            process.env.NIMBUS_EXPOSE_RESET_TOKENS === 'true' &&
            process.env.NODE_ENV !== 'production';

        return {
            ok: true,
            userId: subjectUserId,
            expiresAt,
            ...(exposeForDev ? { _devOnlyDeliveryPreview: plaintext } : {}),
        };
    }

    /**
     * B6.7 — GET .../credential-reset status. Never returns a token value (there
     * is none to return — see adminForceReset's docblock).
     */
    async getForceResetStatus(subjectUserId: string) {
        const live = await this.prisma.passwordResetToken.findFirst({
            where: {
                userId: subjectUserId,
                purpose: 'FORCE_RESET_BY_ADMIN',
                consumedAt: null,
                invalidatedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            select: { expiresAt: true, createdAt: true },
        });

        return {
            userId: subjectUserId,
            pending: !!live,
            expiresAt: live?.expiresAt ?? null,
            triggeredAt: live?.createdAt ?? null,
        };
    }

    private async auditRateLimited(
        actor: { id: string; branchId?: string | null },
        subjectUserId: string,
        meta: { ipAddress?: string; userAgent?: string },
        scope: 'subject' | 'actor',
    ) {
        await this.audit.log({
            actorUserId: actor.id,
            action: 'CREDENTIAL_RESET_RATE_LIMITED',
            entityType: 'User',
            entityId: subjectUserId,
            metadata: { branchId: actor.branchId ?? null, scope },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });
    }
}
