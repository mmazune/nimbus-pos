import {
    Injectable,
    BadRequestException,
    UnauthorizedException,
    NotFoundException,
    ConflictException,
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
 */
@Injectable()
export class PasswordLifecycleService {
    private readonly SALT_ROUNDS = 12;
    private readonly RESET_TTL_MINUTES = 60;

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
}
