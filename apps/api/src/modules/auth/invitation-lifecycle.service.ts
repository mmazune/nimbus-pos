import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import { AcceptInvitationDto } from './dto';

/**
 * BG1 — Invitation lifecycle (accept-side).
 * Resend / revoke live in ClientOnboardingService alongside the create path.
 *
 * Token model: caller passes plaintext `inv_<hex>` token; we SHA-256 it and
 * look it up by token_hash. Tokens are single-use and 14d default expiry.
 */
@Injectable()
export class InvitationLifecycleService {
    private readonly SALT_ROUNDS = 12;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    static hashToken(plaintext: string): string {
        return crypto.createHash('sha256').update(plaintext).digest('hex');
    }

    /**
     * POST /api/auth/invitations/accept
     * Public endpoint — caller proves possession of the invitation token.
     * Sets the user's password and marks the invitation ACCEPTED.
     * Returns the user record + first-login hint (call /api/auth/login next).
     */
    async accept(
        dto: AcceptInvitationDto,
        meta: { ipAddress?: string; userAgent?: string } = {},
    ) {
        const tokenHash = InvitationLifecycleService.hashToken(dto.invitationToken);
        const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.status === 'ACCEPTED') {
            throw new ConflictException('Invitation already accepted');
        }
        if (invitation.status === 'REVOKED') {
            throw new ConflictException('Invitation has been revoked');
        }
        if (invitation.expiresAt < new Date() || invitation.status === 'EXPIRED') {
            // Mark expired if not already
            if (invitation.status !== 'EXPIRED') {
                await this.prisma.invitation.update({
                    where: { id: invitation.id },
                    data: { status: 'EXPIRED' },
                });
            }
            throw new ConflictException('Invitation has expired');
        }

        // Resolve target user — invitation either pre-bound a user, or matches by email
        let user = invitation.userId
            ? await this.prisma.user.findUnique({ where: { id: invitation.userId } })
            : await this.prisma.user.findUnique({ where: { email: invitation.email } });

        if (!user) {
            throw new NotFoundException('User attached to invitation no longer exists');
        }

        const passwordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

        const [updatedUser] = await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    mustChangePassword: false,
                    isActive: true,
                    ...(dto.firstName ? { firstName: dto.firstName } : {}),
                    ...(dto.lastName ? { lastName: dto.lastName } : {}),
                },
            }),
            this.prisma.invitation.update({
                where: { id: invitation.id },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date(),
                    acceptedById: user.id,
                },
            }),
            // Invalidate any outstanding INVITATION_FIRST_LOGIN tokens for this user
            this.prisma.passwordResetToken.updateMany({
                where: {
                    userId: user.id,
                    purpose: 'INVITATION_FIRST_LOGIN',
                    consumedAt: null,
                    invalidatedAt: null,
                },
                data: { invalidatedAt: new Date() },
            }),
        ]);

        await this.audit.log({
            actorUserId: user.id,
            action: 'INVITATION_ACCEPTED',
            entityType: 'Invitation',
            entityId: invitation.id,
            metadata: {
                email: invitation.email,
                organizationId: invitation.organizationId,
                branchId: invitation.branchId,
            },
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
        });

        return {
            ok: true,
            invitationId: invitation.id,
            userId: updatedUser.id,
            email: updatedUser.email,
            organizationId: invitation.organizationId,
            branchId: invitation.branchId,
            nextStep: 'login',
            loginHint:
                'Call POST /api/auth/login with email + new password. Then GET /api/auth/me resolves your active membership context.',
        };
    }
}
