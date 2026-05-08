import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma';

/**
 * BG7 — Inbound API-key authentication for the HMS-integration façade.
 *
 * Reads the plaintext key from header `x-api-key` (or `Authorization: ApiKey <key>`).
 * Looks the key up by SHA-256 hash, verifies status = ACTIVE and not expired,
 * then populates `req.user` with a synthetic principal so that the standard
 * `PermissionGuard` continues to work downstream.
 *
 *   req.user = {
 *     id: `apikey:<apiKeyId>`,
 *     orgId,
 *     branchId,        // null = org-wide key, set = single-branch key
 *     permissions,     // ['hms:read:*', plus key.scopes]
 *     source: 'API_KEY',
 *   }
 *
 * Also touches `lastUsedAt` / `lastUsedIp` (best-effort, fire-and-forget).
 *
 * NOTE: this guard is intentionally a *replacement* for `JwtAuthGuard` on
 * routes it protects — it does NOT chain JWT auth. Routes that should accept
 * BOTH user-JWT and API-key auth need a future composite guard (out of BG7
 * scope; HMS reads are exclusively key-authenticated).
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
    private readonly logger = new Logger(ApiKeyAuthGuard.name);

    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<Request>();

        const raw = this.extractKey(req);
        if (!raw) {
            throw new UnauthorizedException({
                code: 'API_KEY_MISSING',
                message: 'x-api-key header (or Authorization: ApiKey <key>) is required',
            });
        }

        const keyHash = createHash('sha256').update(raw).digest('hex');
        const apiKey = await this.prisma.apiKey.findFirst({
            where: { keyHash },
            select: {
                id: true,
                orgId: true,
                branchId: true,
                status: true,
                scopes: true,
                expiresAt: true,
            },
        });

        if (!apiKey) {
            throw new UnauthorizedException({
                code: 'API_KEY_INVALID',
                message: 'API key not recognised',
            });
        }
        if (apiKey.status !== 'ACTIVE') {
            throw new UnauthorizedException({
                code: 'API_KEY_REVOKED',
                message: 'API key has been revoked',
            });
        }
        if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
            throw new UnauthorizedException({
                code: 'API_KEY_EXPIRED',
                message: 'API key has expired',
            });
        }

        const ip = (req.ip as string) || (req.headers['x-forwarded-for'] as string) || null;

        // Fire-and-forget last-used touch. Failure here must not deny the request.
        this.prisma.apiKey
            .update({
                where: { id: apiKey.id },
                data: { lastUsedAt: new Date(), lastUsedIp: ip ?? undefined },
            })
            .catch((err) => this.logger.warn(`apiKey lastUsed touch failed: ${err?.message}`));

        // Synthesize the request principal. We always grant `hms:read:*` to
        // any active key (the key itself is the authorization decision —
        // creation is gated by `dev:api-key:write` which is owner-only).
        // Additional `scopes` from the key row are merged in for forward-compat.
        const permissions = Array.from(new Set(['hms:read:*', ...(apiKey.scopes ?? [])]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = {
            id: `apikey:${apiKey.id}`,
            apiKeyId: apiKey.id,
            orgId: apiKey.orgId,
            branchId: apiKey.branchId, // null = org-wide
            permissions,
            source: 'API_KEY',
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).apiKeyContext = {
            apiKeyId: apiKey.id,
            orgId: apiKey.orgId,
            branchId: apiKey.branchId,
            ipAddress: ip,
        };

        return true;
    }

    private extractKey(req: Request): string | null {
        const headerKey = req.headers['x-api-key'];
        if (typeof headerKey === 'string' && headerKey.trim().length > 0) {
            return headerKey.trim();
        }
        const auth = req.headers['authorization'];
        if (typeof auth === 'string' && /^ApiKey\s+/i.test(auth)) {
            return auth.replace(/^ApiKey\s+/i, '').trim();
        }
        return null;
    }
}
