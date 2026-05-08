import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { HmsIntegrationService } from './hms-integration.service';

/**
 * BG7 — Append a row to `integration_access_logs` for every request that
 * reached the HMS controller (regardless of success / 4xx / 5xx). Best-effort:
 * the underlying writer swallows DB failures so logging never fails a read.
 */
@Injectable()
export class HmsAccessLogInterceptor implements NestInterceptor {
    constructor(private readonly hms: HmsIntegrationService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const startedAt = Date.now();
        const req = context.switchToHttp().getRequest<Request>();
        const res = context.switchToHttp().getResponse<Response>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (req as any).apiKeyContext as
            | {
                apiKeyId: string;
                orgId: string;
                branchId: string | null;
                ipAddress: string | null;
            }
            | undefined;

        const finalize = (statusCode: number) => {
            if (!ctx) return; // guard rejected the request before populating context
            void this.hms.recordAccess({
                orgId: ctx.orgId,
                apiKeyId: ctx.apiKeyId,
                branchId: ctx.branchId,
                routeMethod: req.method,
                routePath: req.originalUrl?.split('?')[0] ?? req.url,
                statusCode,
                durationMs: Date.now() - startedAt,
                ipAddress: ctx.ipAddress,
                userAgent: (req.headers['user-agent'] as string) ?? null,
                requestId: (req.headers['x-request-id'] as string) ?? null,
            });
        };

        return next.handle().pipe(
            tap({
                next: () => finalize(res.statusCode || 200),
                error: (err: { status?: number }) => finalize(err?.status ?? 500),
            }),
        );
    }
}
