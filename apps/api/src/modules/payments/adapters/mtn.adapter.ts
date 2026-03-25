import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MTN Mobile Money Collections adapter.
 *
 * Handles:
 * - OAuth2 token acquisition (API User + API Key → Bearer token)
 * - RequestToPay initiation
 * - RequestToPay status polling (backup for webhook)
 * - Sandbox API User provisioning helper
 *
 * Auth flow (MTN Collections v1):
 *   1. POST /v1_0/apiuser                         → create API User (sandbox only)
 *   2. POST /v1_0/apiuser/{apiUserId}/apikey       → get API Key   (sandbox only)
 *   3. POST /collection/token/                     → get Bearer token (Basic auth = apiUser:apiKey)
 *   4. POST /collection/v1_0/requesttopay          → initiate payment
 *   5. GET  /collection/v1_0/requesttopay/{refId}  → check status
 *
 * All outbound calls are server-side only.
 */

export interface MtnRequestToPayParams {
  /** UUID v4 used as X-Reference-Id and externalId */
  externalId: string;
  /** Amount as string (MTN expects string) */
  amount: string;
  /** ISO 4217 currency code, e.g. "UGX" */
  currency: string;
  /** MSISDN without leading +, e.g. "256700000000" */
  payerMsisdn: string;
  /** Human-readable message shown to payer */
  payerMessage?: string;
  /** Merchant/payee note */
  payeeNote?: string;
  /** Optional callback URL override */
  callbackUrl?: string;
}

export interface MtnRequestToPayResult {
  success: boolean;
  /** The X-Reference-Id used */
  externalId: string;
  /** HTTP status from MTN (202 = accepted) */
  httpStatus?: number;
  /** Error message if failed */
  error?: string;
}

export interface MtnPaymentStatusResult {
  /** Raw status from MTN: PENDING, SUCCESSFUL, FAILED */
  providerStatus: string;
  /** Provider's own transaction ID if returned */
  financialTransactionId?: string;
  /** Payer info from MTN */
  payerMsisdn?: string;
  /** Confirmed amount */
  amount?: string;
  /** Currency */
  currency?: string;
  /** Reason for failure */
  reason?: string;
  /** Full raw response */
  raw: Record<string, unknown>;
}

@Injectable()
export class MtnAdapter {
  private readonly logger = new Logger(MtnAdapter.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly targetEnv: string;
  private readonly subscriptionKey: string;
  private readonly apiUser: string;
  private readonly apiKey: string;
  private readonly callbackUrl: string;
  private readonly currency: string;
  private readonly payerMessage: string;
  private readonly payeeNote: string;
  private readonly callbackHost: string;

  /** Cached bearer token and expiry */
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('PAY_MTN_ENABLED', 'false') === 'true';
    this.baseUrl = this.config.get<string>(
      'PAY_MTN_BASE_URL',
      'https://sandbox.momodeveloper.mtn.com',
    );
    this.targetEnv = this.config.get<string>('PAY_MTN_TARGET_ENV', 'sandbox');
    this.subscriptionKey = this.config.get<string>('PAY_MTN_ACTIVE_SUBSCRIPTION_KEY', '');
    this.apiUser = this.config.get<string>('PAY_MTN_API_USER', '');
    this.apiKey = this.config.get<string>('PAY_MTN_API_KEY', '');
    this.callbackUrl = this.config.get<string>('PAY_MTN_CALLBACK_URL', '');
    this.callbackHost = this.config.get<string>('PAY_MTN_PROVIDER_CALLBACK_HOST', '');
    this.currency = this.config.get<string>('PAY_MTN_CURRENCY', 'UGX');
    this.payerMessage = this.config.get<string>(
      'PAY_MTN_PAYER_MESSAGE',
      'Nimbus POS payment request',
    );
    this.payeeNote = this.config.get<string>('PAY_MTN_PAYEE_NOTE', 'Restaurant bill payment');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getDefaultCurrency(): string {
    return this.currency;
  }

  // ── Token Management ──

  /**
   * Obtain a Bearer token using Basic auth (apiUser:apiKey).
   * Tokens are cached until 60s before expiry.
   */
  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
    const url = `${this.baseUrl}/collection/token/`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`MTN token request failed: ${res.status} ${body}`);
      throw new Error(`MTN token request failed: ${res.status}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = data.access_token;
    // Cache until 60 seconds before expiry
    this.tokenExpiresAt = now + (data.expires_in - 60) * 1000;
    return this.cachedToken;
  }

  // ── Request to Pay ──

  /**
   * Initiate an MTN Collections RequestToPay.
   * Returns 202 Accepted if MTN accepted the request.
   * The actual result comes via webhook callback.
   */
  async requestToPay(params: MtnRequestToPayParams): Promise<MtnRequestToPayResult> {
    if (!this.enabled) {
      return { success: false, externalId: params.externalId, error: 'MTN adapter disabled' };
    }

    try {
      const token = await this.getToken();
      const url = `${this.baseUrl}/collection/v1_0/requesttopay`;
      const callback = params.callbackUrl || this.callbackUrl;

      const body = {
        amount: params.amount,
        currency: params.currency || this.currency,
        externalId: params.externalId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: params.payerMsisdn,
        },
        payerMessage: params.payerMessage || this.payerMessage,
        payeeNote: params.payeeNote || this.payeeNote,
      };

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': params.externalId,
        'X-Target-Environment': this.targetEnv,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
      };

      if (callback) {
        headers['X-Callback-Url'] = callback;
      }

      this.logger.log(
        `MTN RequestToPay → ${params.payerMsisdn} amount=${params.amount} ref=${params.externalId}`,
      );

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.status === 202) {
        return { success: true, externalId: params.externalId, httpStatus: 202 };
      }

      const errBody = await res.text();
      this.logger.error(`MTN RequestToPay failed: ${res.status} ${errBody}`);
      return {
        success: false,
        externalId: params.externalId,
        httpStatus: res.status,
        error: errBody,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`MTN RequestToPay exception: ${message}`);
      return { success: false, externalId: params.externalId, error: message };
    }
  }

  // ── Status Check (polling fallback) ──

  /**
   * Check the status of a RequestToPay by its X-Reference-Id.
   * Useful as a backup when webhook hasn't arrived.
   */
  async getPaymentStatus(externalId: string): Promise<MtnPaymentStatusResult> {
    const token = await this.getToken();
    const url = `${this.baseUrl}/collection/v1_0/requesttopay/${externalId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': this.targetEnv,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`MTN status check failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      providerStatus: (data.status as string) || 'UNKNOWN',
      financialTransactionId: data.financialTransactionId as string | undefined,
      payerMsisdn: (data.payer as Record<string, string>)?.partyId,
      amount: data.amount as string | undefined,
      currency: data.currency as string | undefined,
      reason: (data.reason as Record<string, string>)?.message,
      raw: data,
    };
  }

  // ── Sandbox Provisioning Helpers ──

  /**
   * Create a sandbox API User. Only needed once during initial setup.
   * Requires: X-Reference-Id (UUID v4 you choose as your apiUserId),
   * Ocp-Apim-Subscription-Key, and providerCallbackHost in body.
   */
  async createSandboxApiUser(apiUserId: string): Promise<{ success: boolean; error?: string }> {
    const url = `${this.baseUrl}/v1_0/apiuser`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Reference-Id': apiUserId,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerCallbackHost: this.callbackHost || 'example.com' }),
    });

    if (res.status === 201) {
      this.logger.log(`Sandbox API User ${apiUserId} created successfully`);
      return { success: true };
    }
    const errBody = await res.text();
    return { success: false, error: `${res.status}: ${errBody}` };
  }

  /**
   * Get the API Key for a sandbox API User.
   */
  async createSandboxApiKey(apiUserId: string): Promise<{ apiKey?: string; error?: string }> {
    const url = `${this.baseUrl}/v1_0/apiuser/${apiUserId}/apikey`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { apiKey: string };
      this.logger.log(`Sandbox API Key obtained for ${apiUserId}`);
      return { apiKey: data.apiKey };
    }
    const errBody = await res.text();
    return { error: `${res.status}: ${errBody}` };
  }

  // ── Webhook Verification ──

  /**
   * Normalize MTN webhook/callback status to internal status.
   * MTN sends: SUCCESSFUL, FAILED, PENDING, REJECTED, TIMEOUT, EXPIRED
   */
  normalizeStatus(
    providerStatus: string | null,
  ): 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'CANCELLED' | null {
    if (!providerStatus) return null;
    const upper = providerStatus.toUpperCase();
    switch (upper) {
      case 'SUCCESSFUL':
      case 'SUCCESS':
      case 'SUCCEEDED':
      case 'COMPLETED':
        return 'SUCCEEDED';
      case 'FAILED':
      case 'FAILURE':
      case 'REJECTED':
      case 'TIMEOUT':
      case 'EXPIRED':
        return 'FAILED';
      case 'PENDING':
      case 'PROCESSING':
        return 'PENDING';
      case 'CANCELLED':
      case 'CANCELED':
        return 'CANCELLED';
      default:
        return null;
    }
  }
}
