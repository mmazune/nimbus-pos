import {
    Injectable,
    BadRequestException,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateCheckoutSessionDto, ReconcileStatusDto } from './dto';
import { randomUUID } from 'crypto';

@Injectable()
export class BillingPesapalService {
    private readonly consumerKey: string;
    private readonly consumerSecret: string;
    private readonly baseUrl: string;
    private readonly ipnCallbackUrl: string;
    private cachedToken: string | null = null;
    private tokenExpiresAt: number = 0;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly config: ConfigService,
    ) {
        this.consumerKey = this.config.get<string>('PESAPAL_CONSUMER_KEY', '');
        this.consumerSecret = this.config.get<string>('PESAPAL_CONSUMER_SECRET', '');
        this.baseUrl = this.config.get<string>('PESAPAL_BASE_URL', 'https://pay.pesapal.com/v3');
        this.ipnCallbackUrl = this.config.get<string>('PESAPAL_IPN_CALLBACK_URL', '');
    }

    // ── Auth ──

    private async authenticate(): Promise<string> {
        if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
            return this.cachedToken;
        }

        if (!this.consumerKey || !this.consumerSecret) {
            throw new InternalServerErrorException(
                'PesaPal credentials not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.',
            );
        }

        const res = await fetch(`${this.baseUrl}/api/Auth/RequestToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                consumer_key: this.consumerKey,
                consumer_secret: this.consumerSecret,
            }),
        });

        if (!res.ok) {
            throw new InternalServerErrorException('PesaPal authentication failed');
        }

        const data = (await res.json()) as { token: string; expiryDate: string };
        this.cachedToken = data.token;
        this.tokenExpiresAt = new Date(data.expiryDate).getTime() - 60_000;
        return data.token;
    }

    // ── IPN Registration ──

    private async registerIpn(token: string): Promise<string> {
        if (!this.ipnCallbackUrl) {
            throw new InternalServerErrorException(
                'PESAPAL_IPN_CALLBACK_URL not configured',
            );
        }

        const res = await fetch(`${this.baseUrl}/api/URLSetup/RegisterIPN`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                url: this.ipnCallbackUrl,
                ipn_notification_type: 'POST',
            }),
        });

        if (!res.ok) {
            throw new InternalServerErrorException('Failed to register IPN URL with PesaPal');
        }

        const data = (await res.json()) as { ipn_id: string };
        return data.ipn_id;
    }

    // ── Org context ──

    async resolveOrgContext(userId: string): Promise<{ organizationId: string }> {
        const membership = await this.prisma.membership.findFirst({
            where: { userId, status: 'ACTIVE' },
        });
        if (!membership) {
            throw new BadRequestException('No active membership found');
        }
        return { organizationId: membership.organizationId };
    }

    // ── Checkout Session ──

    async createCheckoutSession(orgId: string, dto: CreateCheckoutSessionDto, userId: string) {
        const plan = await this.prisma.plan.findUnique({
            where: { code: dto.planCode },
        });
        if (!plan || plan.status !== 'ACTIVE') {
            throw new BadRequestException(`Plan "${dto.planCode}" not found or not active`);
        }

        if (!['MONTHLY', 'ANNUAL'].includes(dto.billingCycle)) {
            throw new BadRequestException('billingCycle must be MONTHLY or ANNUAL');
        }

        const amount = dto.billingCycle === 'ANNUAL'
            ? plan.priceAnnual.toNumber()
            : plan.priceMonthly.toNumber();

        // Auto-cancel any prior INITIATED session so the user can retry checkout
        // (PesaPal redirect tokens are short-lived; a stale INITIATED row should
        // never block a new checkout attempt).
        await this.prisma.pesapalTransaction.updateMany({
            where: { orgId, status: 'INITIATED' },
            data: { status: 'CANCELLED' },
        });

        const orderTrackingId = randomUUID();
        const merchantReference = `NIM-${orgId.substring(0, 8)}-${Date.now()}`;

        // Authenticate and register IPN
        const token = await this.authenticate();
        const ipnId = await this.registerIpn(token);

        const callbackUrl = dto.callbackUrl || this.config.get<string>('PESAPAL_REDIRECT_URL', '');

        // Submit order to PesaPal
        const orderPayload = {
            id: orderTrackingId,
            currency: 'USD',
            amount,
            description: `Nimbus POS - ${plan.name} Plan (${dto.billingCycle})`,
            callback_url: callbackUrl,
            notification_id: ipnId,
            billing_address: {
                email_address: '', // filled by PesaPal hosted page
            },
        };

        const orderRes = await fetch(`${this.baseUrl}/api/Transactions/SubmitOrderRequest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(orderPayload),
        });

        if (!orderRes.ok) {
            throw new InternalServerErrorException('Failed to create PesaPal order');
        }

        const orderData = (await orderRes.json()) as {
            order_tracking_id: string;
            merchant_reference: string;
            redirect_url: string;
        };

        // Save transaction
        const txn = await this.prisma.pesapalTransaction.create({
            data: {
                orgId,
                orderTrackingId,
                merchantReference,
                amount,
                currency: 'USD',
                description: orderPayload.description,
                status: 'INITIATED',
                callbackUrl,
                ipnId,
                redirectUrl: orderData.redirect_url,
            },
        });

        // Ensure subscription exists in PENDING_PAYMENT state
        const existingSub = await this.prisma.subscription.findUnique({ where: { orgId } });
        if (!existingSub) {
            const now = new Date();
            const periodEnd = new Date(now);
            if (dto.billingCycle === 'ANNUAL') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }
            await this.prisma.subscription.create({
                data: {
                    orgId,
                    planId: plan.id,
                    status: 'PENDING_PAYMENT',
                    billingCycle: dto.billingCycle as 'MONTHLY' | 'ANNUAL',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                },
            });
        }

        await this.audit.log({
            actorUserId: userId,
            action: 'SAAS_CHECKOUT_SESSION_CREATED',
            entityType: 'PesapalTransaction',
            entityId: txn.id,
            metadata: { planCode: dto.planCode, billingCycle: dto.billingCycle, amount, orderTrackingId },
        });

        return {
            orderTrackingId,
            redirectUrl: orderData.redirect_url,
            amount: amount.toString(),
            currency: 'USD',
            plan: { code: plan.code, name: plan.name },
        };
    }

    // ── Callback ──

    async handleCallback(orderTrackingId: string, pesapalTxnId: string) {
        const txn = await this.prisma.pesapalTransaction.findUnique({
            where: { orderTrackingId },
        });

        if (!txn) {
            throw new NotFoundException(`Transaction not found for order ${orderTrackingId}`);
        }

        await this.prisma.pesapalTransaction.update({
            where: { id: txn.id },
            data: { pesapalTxnId, status: 'REDIRECTED' },
        });

        return { status: 'REDIRECTED', orderTrackingId, pesapalTxnId };
    }

    // ── IPN ──

    async handleIpn(body: Record<string, unknown>) {
        const orderTrackingId = body.OrderTrackingId as string;
        const notificationType = body.OrderNotificationType as string;
        const merchantReference = body.OrderMerchantReference as string;

        // Log the IPN
        await this.prisma.pesapalIpnLog.create({
            data: {
                orderTrackingId: orderTrackingId || 'unknown',
                notificationType: notificationType || 'unknown',
                pesapalTxnId: (body.pesapal_transaction_tracking_id as string) || null,
                paymentStatusCode: (body.payment_status_description as string) || null,
                rawPayload: body as object,
            },
        });

        if (!orderTrackingId) {
            return { status: 'IGNORED', reason: 'Missing OrderTrackingId' };
        }

        // Reconcile status
        const result = await this.reconcileTransactionStatus(orderTrackingId);
        return { status: 'PROCESSED', orderTrackingId, result };
    }

    // ── Reconcile Status ──

    async reconcileTransactionStatus(orderTrackingId: string) {
        const txn = await this.prisma.pesapalTransaction.findUnique({
            where: { orderTrackingId },
        });

        if (!txn) {
            throw new NotFoundException(`Transaction not found: ${orderTrackingId}`);
        }

        const token = await this.authenticate();

        const statusRes = await fetch(
            `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        if (!statusRes.ok) {
            throw new InternalServerErrorException('Failed to get PesaPal transaction status');
        }

        const statusData = (await statusRes.json()) as {
            payment_status_description: string;
            payment_method: string;
            payment_account: string;
            amount: number;
            created_date: string;
            confirmation_code: string;
            description: string;
        };

        const pesapalStatus = statusData.payment_status_description?.toUpperCase();
        let newStatus: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INITIATED' = 'INITIATED';

        if (pesapalStatus === 'COMPLETED') {
            newStatus = 'COMPLETED';
        } else if (pesapalStatus === 'FAILED') {
            newStatus = 'FAILED';
        } else if (pesapalStatus === 'INVALID' || pesapalStatus === 'REVERSED') {
            newStatus = 'CANCELLED';
        }

        await this.prisma.pesapalTransaction.update({
            where: { id: txn.id },
            data: {
                status: newStatus,
                paymentMethod: statusData.payment_method,
                paymentAccount: statusData.payment_account,
                confirmedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
                failedAt: newStatus === 'FAILED' ? new Date() : undefined,
            },
        });

        // If completed, activate subscription
        if (newStatus === 'COMPLETED' && txn.orgId) {
            const sub = await this.prisma.subscription.findUnique({ where: { orgId: txn.orgId } });
            if (sub && (sub.status === 'PENDING_PAYMENT' || sub.status === 'PAST_DUE')) {
                const now = new Date();
                const periodEnd = new Date(now);
                if (sub.billingCycle === 'ANNUAL') {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                } else {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                }

                await this.prisma.subscription.update({
                    where: { orgId: txn.orgId },
                    data: {
                        status: 'ACTIVE',
                        currentPeriodStart: now,
                        currentPeriodEnd: periodEnd,
                    },
                });

                // Update onboarding if exists
                await this.prisma.onboardingProgress.updateMany({
                    where: { orgId: txn.orgId, subscriptionPaid: 'NOT_STARTED' },
                    data: { subscriptionPaid: 'COMPLETED' },
                });

                await this.audit.log({
                    action: 'SAAS_PAYMENT_CONFIRMED',
                    entityType: 'Subscription',
                    entityId: sub.id,
                    metadata: {
                        orderTrackingId,
                        paymentMethod: statusData.payment_method,
                        amount: statusData.amount,
                    },
                });
            }
        }

        if (newStatus === 'FAILED') {
            await this.audit.log({
                action: 'SAAS_PAYMENT_FAILED',
                entityType: 'PesapalTransaction',
                entityId: txn.id,
                metadata: { orderTrackingId, pesapalStatus },
            });
        }

        return {
            orderTrackingId,
            status: newStatus,
            paymentMethod: statusData.payment_method,
        };
    }

    // ── Manual reconcile endpoint ──

    async reconcileStatus(dto: ReconcileStatusDto, userId: string) {
        const result = await this.reconcileTransactionStatus(dto.orderTrackingId);

        await this.audit.log({
            actorUserId: userId,
            action: 'SAAS_PAYMENT_RECONCILED',
            entityType: 'PesapalTransaction',
            metadata: { orderTrackingId: dto.orderTrackingId, result },
        });

        return result;
    }
}
