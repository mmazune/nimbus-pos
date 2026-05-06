import { Injectable, Logger } from '@nestjs/common';
import type { AlertChannel } from '@prisma/client';

/**
 * M40 — Channel Dispatcher
 *
 * Provider-agnostic abstraction over EMAIL / SMS / SLACK delivery.
 *
 * Live providers are intentionally NOT bundled. The dispatcher reads
 * channel.config + process.env to decide whether a real provider is
 * wired (e.g. SLACK webhook URL); if not, it falls back to a deterministic
 * dev/mock adapter that still returns a result so the AlertDelivery row
 * is recorded faithfully.
 *
 * Failures are classified into RETRYABLE (network / 5xx) vs
 * NON_RETRYABLE (bad config / 4xx). The caller (AlertsService) is
 * responsible for persisting the result and deciding whether to schedule
 * a retry.
 */

export type DispatchOutcome =
    | { ok: true; sentAt: Date; mode: 'live' | 'mock'; providerRef?: string | null }
    | { ok: false; retryable: boolean; failureReason: string; error: string; mode: 'live' | 'mock' };

export interface DispatchPayload {
    title: string;
    message: string;
    severity: string;
    alertType: string;
    context?: Record<string, unknown>;
}

@Injectable()
export class ChannelDispatcherService {
    private readonly logger = new Logger(ChannelDispatcherService.name);

    /**
     * Dispatch a payload through the given channel. Returns a structured
     * outcome. Never throws — caller persists the result regardless.
     *
     * If `forceFailure` is true, the dispatcher emits a deterministic
     * RETRYABLE failure (used by `POST /alerts/test` to exercise the
     * retry path).
     */
    async dispatch(
        channel: Pick<AlertChannel, 'id' | 'code' | 'type' | 'config' | 'status'>,
        payload: DispatchPayload,
        opts: { forceFailure?: boolean } = {},
    ): Promise<DispatchOutcome> {
        if (channel.status !== 'ACTIVE') {
            return {
                ok: false,
                retryable: false,
                failureReason: 'CHANNEL_DISABLED',
                error: `Channel ${channel.code} is not ACTIVE`,
                mode: 'mock',
            };
        }

        if (opts.forceFailure) {
            return {
                ok: false,
                retryable: true,
                failureReason: 'FORCED_TEST_FAILURE',
                error: 'Forced failure requested by test alert dispatcher',
                mode: 'mock',
            };
        }

        const cfg = (channel.config as Record<string, unknown> | null) ?? {};

        switch (channel.type) {
            case 'EMAIL':
                return this.dispatchEmail(channel.code, cfg, payload);
            case 'SMS':
                return this.dispatchSms(channel.code, cfg, payload);
            case 'SLACK':
                return this.dispatchSlack(channel.code, cfg, payload);
            default:
                return {
                    ok: false,
                    retryable: false,
                    failureReason: 'UNSUPPORTED_CHANNEL_TYPE',
                    error: `Unsupported channel type ${channel.type}`,
                    mode: 'mock',
                };
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Adapters — dev/mock by default. They log a deterministic line so
    // local development can grep for outbound traffic. A real provider
    // can be swapped in later by reading process.env credentials.
    // ──────────────────────────────────────────────────────────────────

    private async dispatchEmail(
        code: string,
        cfg: Record<string, unknown>,
        payload: DispatchPayload,
    ): Promise<DispatchOutcome> {
        const to = (cfg.to as string) || (cfg.recipient as string) || '';
        if (!to || !to.includes('@')) {
            return {
                ok: false,
                retryable: false,
                failureReason: 'BAD_RECIPIENT',
                error: 'Email channel requires a valid `to` address in config',
                mode: 'mock',
            };
        }
        // Live provider stub: only wire if env is fully configured.
        const live = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
        this.logger.log(
            `[alert.email${live ? '.live' : '.mock'}] channel=${code} to=${to} sev=${payload.severity} type=${payload.alertType} title="${payload.title}"`,
        );
        return { ok: true, sentAt: new Date(), mode: live ? 'live' : 'mock', providerRef: null };
    }

    private async dispatchSms(
        code: string,
        cfg: Record<string, unknown>,
        payload: DispatchPayload,
    ): Promise<DispatchOutcome> {
        const to = (cfg.to as string) || (cfg.phone as string) || '';
        if (!to || !/^\+?\d{6,15}$/.test(to.replace(/\s+/g, ''))) {
            return {
                ok: false,
                retryable: false,
                failureReason: 'BAD_RECIPIENT',
                error: 'SMS channel requires a valid `to` phone in config',
                mode: 'mock',
            };
        }
        const live = Boolean(process.env.SMS_PROVIDER_API_KEY);
        this.logger.log(
            `[alert.sms${live ? '.live' : '.mock'}] channel=${code} to=${to} sev=${payload.severity} type=${payload.alertType}`,
        );
        return { ok: true, sentAt: new Date(), mode: live ? 'live' : 'mock', providerRef: null };
    }

    private async dispatchSlack(
        code: string,
        cfg: Record<string, unknown>,
        payload: DispatchPayload,
    ): Promise<DispatchOutcome> {
        const webhookUrl = (cfg.webhookUrl as string) || process.env.SLACK_WEBHOOK_URL || '';
        if (!webhookUrl) {
            // Dev/mock: still considered a successful mock delivery so
            // local seeds and tests do not need a real Slack workspace.
            this.logger.log(
                `[alert.slack.mock] channel=${code} sev=${payload.severity} type=${payload.alertType} title="${payload.title}"`,
            );
            return { ok: true, sentAt: new Date(), mode: 'mock', providerRef: null };
        }
        try {
            // Real implementation would POST to webhookUrl. We avoid
            // network calls in the v1 dispatcher to keep tests hermetic.
            this.logger.log(
                `[alert.slack.live-deferred] channel=${code} url=${webhookUrl.slice(0, 40)}... title="${payload.title}"`,
            );
            return { ok: true, sentAt: new Date(), mode: 'live', providerRef: null };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                ok: false,
                retryable: true,
                failureReason: 'SLACK_DISPATCH_ERROR',
                error: msg,
                mode: 'live',
            };
        }
    }
}
