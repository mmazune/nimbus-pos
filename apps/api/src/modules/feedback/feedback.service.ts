import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { AuditService } from '../../common/audit';
import {
  CreateFeedbackRequestDto,
  SubmitPublicFeedbackDto,
  ListFeedbackQueryDto,
  TagFeedbackDto,
  ResolveFeedbackDto,
  NpsSummaryQueryDto,
} from './dto';
import {
  FeedbackSentiment,
  NpsBucket,
  FeedbackRequestStatus,
  FeedbackStatus,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Helpers ──

  /** Compute NPS bucket from 0-10 score. */
  computeNpsBucket(npsScore: number): NpsBucket {
    if (npsScore <= 6) return NpsBucket.DETRACTOR;
    if (npsScore <= 8) return NpsBucket.PASSIVE;
    return NpsBucket.PROMOTER;
  }

  /** Infer sentiment from rating and/or npsScore. */
  inferSentiment(rating?: number, npsScore?: number): FeedbackSentiment {
    // If NPS score exists, use it as primary signal
    if (npsScore !== undefined && npsScore !== null) {
      if (npsScore <= 3) return FeedbackSentiment.CRITICAL;
      if (npsScore <= 6) return FeedbackSentiment.NEGATIVE;
      if (npsScore <= 8) return FeedbackSentiment.NEUTRAL;
      return FeedbackSentiment.POSITIVE;
    }
    // Fall back to star rating (1-5)
    if (rating !== undefined && rating !== null) {
      if (rating <= 1) return FeedbackSentiment.CRITICAL;
      if (rating <= 2) return FeedbackSentiment.NEGATIVE;
      if (rating <= 3) return FeedbackSentiment.NEUTRAL;
      return FeedbackSentiment.POSITIVE;
    }
    return FeedbackSentiment.NEUTRAL;
  }

  /** Generate a secure random token. */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ── Feedback Request ──

  async createFeedbackRequest(
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: CreateFeedbackRequestDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const token = this.generateToken();
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    const request = await this.prisma.feedbackRequest.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        orderId: dto.orderId || null,
        reservationId: dto.reservationId || null,
        eventId: dto.eventId || null,
        token,
        source: dto.source,
        status: FeedbackRequestStatus.PENDING,
        customerName: dto.customerName || null,
        customerPhone: dto.customerPhone || null,
        customerEmail: dto.customerEmail || null,
        expiresAt,
        createdById: userId,
      },
    });

    await this.audit.log({
      action: 'FEEDBACK_REQUEST_CREATED',
      actorUserId: userId,
      entityType: 'FeedbackRequest',
      entityId: request.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        token: request.token,
        source: request.source,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return request;
  }

  async listFeedbackRequests(ctx: { branchId: string; organizationId: string }) {
    return this.prisma.feedbackRequest.findMany({
      where: { orgId: ctx.organizationId, branchId: ctx.branchId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Public Token Lookup ──

  async lookupToken(token: string) {
    const request = await this.prisma.feedbackRequest.findUnique({
      where: { token },
      select: {
        id: true,
        source: true,
        status: true,
        customerName: true,
        expiresAt: true,
        branchId: true,
        orderId: true,
        reservationId: true,
        eventId: true,
        branch: { select: { name: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Invalid feedback token');
    }

    if (
      request.status === FeedbackRequestStatus.EXPIRED ||
      (request.expiresAt && new Date() > request.expiresAt)
    ) {
      throw new BadRequestException('Feedback request has expired');
    }
    if (request.status === FeedbackRequestStatus.SUBMITTED) {
      throw new ConflictException('Feedback has already been submitted for this request');
    }
    if (request.status === FeedbackRequestStatus.CANCELLED) {
      throw new BadRequestException('Feedback request has been cancelled');
    }

    // Mark as OPENED if still PENDING
    if (request.status === FeedbackRequestStatus.PENDING) {
      await this.prisma.feedbackRequest.update({
        where: { token },
        data: { status: FeedbackRequestStatus.OPENED, openedAt: new Date() },
      });
    }

    return {
      id: request.id,
      source: request.source,
      customerName: request.customerName,
      branchName: request.branch?.name,
      hasOrder: !!request.orderId,
      hasReservation: !!request.reservationId,
      hasEvent: !!request.eventId,
    };
  }

  // ── Public Feedback Submission ──

  async submitPublicFeedback(
    dto: SubmitPublicFeedbackDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const request = await this.prisma.feedbackRequest.findUnique({
      where: { token: dto.token },
    });

    if (!request) {
      throw new NotFoundException('Invalid feedback token');
    }

    if (request.status === FeedbackRequestStatus.SUBMITTED) {
      throw new ConflictException('Feedback has already been submitted for this request');
    }
    if (
      request.status === FeedbackRequestStatus.EXPIRED ||
      (request.expiresAt && new Date() > request.expiresAt)
    ) {
      throw new BadRequestException('Feedback request has expired');
    }
    if (request.status === FeedbackRequestStatus.CANCELLED) {
      throw new BadRequestException('Feedback request has been cancelled');
    }

    const sentiment = this.inferSentiment(dto.rating, dto.npsScore);
    const npsBucket =
      dto.npsScore !== undefined && dto.npsScore !== null
        ? this.computeNpsBucket(dto.npsScore)
        : null;

    const now = new Date();

    const feedback = await this.prisma.$transaction(async (tx) => {
      // Create feedback
      const fb = await tx.feedback.create({
        data: {
          orgId: request.orgId,
          branchId: request.branchId,
          orderId: request.orderId,
          reservationId: request.reservationId,
          eventId: request.eventId,
          feedbackRequestId: request.id,
          customerName: dto.customerName || request.customerName || null,
          customerPhone: dto.customerPhone || request.customerPhone || null,
          customerEmail: dto.customerEmail || request.customerEmail || null,
          source: request.source,
          rating: dto.rating ?? null,
          npsScore: dto.npsScore ?? null,
          npsBucket,
          sentiment,
          comment: dto.comment || null,
          status: FeedbackStatus.NEW,
          submittedAt: now,
          metadata: auditMeta
            ? { ipAddress: auditMeta.ipAddress, userAgent: auditMeta.userAgent }
            : undefined,
        },
      });

      // Mark request as SUBMITTED
      await tx.feedbackRequest.update({
        where: { id: request.id },
        data: { status: FeedbackRequestStatus.SUBMITTED, submittedAt: now },
      });

      return fb;
    });

    await this.audit.log({
      action: 'FEEDBACK_SUBMITTED',
      entityType: 'Feedback',
      entityId: feedback.id,
      metadata: {
        orgId: request.orgId,
        branchId: request.branchId,
        sentiment,
        rating: dto.rating,
        npsScore: dto.npsScore,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return feedback;
  }

  // ── Admin: List / Get Feedback ──

  async listFeedback(
    ctx: { branchId: string; organizationId: string },
    query: ListFeedbackQueryDto,
  ) {
    const where: Prisma.FeedbackWhereInput = {
      orgId: ctx.organizationId,
      branchId: ctx.branchId,
    };
    if (query.status) where.status = query.status;
    if (query.sentiment) where.sentiment = query.sentiment;
    if (query.source) where.source = query.source;
    if (query.orderId) where.orderId = query.orderId;
    if (query.reservationId) where.reservationId = query.reservationId;
    if (query.eventId) where.eventId = query.eventId;

    const [data, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: Number(query.skip || 0),
        take: Number(query.take || 20),
        include: { tags: true },
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return { data, total, skip: Number(query.skip || 0), take: Number(query.take || 20) };
  }

  async getFeedback(id: string, ctx: { branchId: string; organizationId: string }) {
    const feedback = await this.prisma.feedback.findFirst({
      where: { id, orgId: ctx.organizationId, branchId: ctx.branchId },
      include: { tags: true, feedbackRequest: true },
    });
    if (!feedback) throw new NotFoundException('Feedback not found');
    return feedback;
  }

  // ── Admin: Tag ──

  async tagFeedback(
    feedbackId: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: TagFeedbackDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const feedback = await this.prisma.feedback.findFirst({
      where: { id: feedbackId, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!feedback) throw new NotFoundException('Feedback not found');

    // Check for duplicate tag (unique constraint will catch it, but give a cleaner error)
    const existingTag = await this.prisma.feedbackTag.findUnique({
      where: { feedbackId_tagKey: { feedbackId, tagKey: dto.tagKey } },
    });
    if (existingTag) {
      throw new ConflictException(`Tag "${dto.tagKey}" already exists on this feedback`);
    }

    const tag = await this.prisma.feedbackTag.create({
      data: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        feedbackId,
        tagKey: dto.tagKey,
        tagLabel: dto.tagLabel,
        createdById: userId,
      },
    });

    await this.audit.log({
      action: 'FEEDBACK_TAGGED',
      actorUserId: userId,
      entityType: 'FeedbackTag',
      entityId: tag.id,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        tagKey: dto.tagKey,
        tagLabel: dto.tagLabel,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return tag;
  }

  // ── Admin: List Tags ──

  async listTags(ctx: { branchId: string; organizationId: string }) {
    return this.prisma.feedbackTag.findMany({
      where: { orgId: ctx.organizationId, branchId: ctx.branchId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ── Admin: Acknowledge ──

  async acknowledgeFeedback(
    feedbackId: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const feedback = await this.prisma.feedback.findFirst({
      where: { id: feedbackId, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!feedback) throw new NotFoundException('Feedback not found');
    if (feedback.status !== FeedbackStatus.NEW) {
      throw new ConflictException(`Feedback is already ${feedback.status}`);
    }

    const updated = await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status: FeedbackStatus.ACKNOWLEDGED,
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'FEEDBACK_ACKNOWLEDGED',
      actorUserId: userId,
      entityType: 'Feedback',
      entityId: feedbackId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        oldStatus: FeedbackStatus.NEW,
        newStatus: FeedbackStatus.ACKNOWLEDGED,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return updated;
  }

  // ── Admin: Resolve ──

  async resolveFeedback(
    feedbackId: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    dto: ResolveFeedbackDto,
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const feedback = await this.prisma.feedback.findFirst({
      where: { id: feedbackId, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!feedback) throw new NotFoundException('Feedback not found');
    if (feedback.status === FeedbackStatus.RESOLVED) {
      throw new ConflictException('Feedback is already resolved');
    }
    if (feedback.status === FeedbackStatus.DISMISSED) {
      throw new ConflictException('Feedback has been dismissed');
    }

    const updated = await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status: FeedbackStatus.RESOLVED,
        resolvedById: userId,
        resolvedAt: new Date(),
        resolutionNotes: dto.resolutionNotes || null,
      },
    });

    await this.audit.log({
      action: 'FEEDBACK_RESOLVED',
      actorUserId: userId,
      entityType: 'Feedback',
      entityId: feedbackId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        oldStatus: feedback.status,
        newStatus: FeedbackStatus.RESOLVED,
        resolutionNotes: dto.resolutionNotes,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return updated;
  }

  // ── Admin: Cancel Feedback Request ──

  async cancelFeedbackRequest(
    requestId: string,
    userId: string,
    ctx: { branchId: string; organizationId: string },
    auditMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const request = await this.prisma.feedbackRequest.findFirst({
      where: { id: requestId, orgId: ctx.organizationId, branchId: ctx.branchId },
    });
    if (!request) throw new NotFoundException('Feedback request not found');
    if (request.status === FeedbackRequestStatus.SUBMITTED) {
      throw new ConflictException('Cannot cancel — feedback already submitted');
    }
    if (request.status === FeedbackRequestStatus.CANCELLED) {
      throw new ConflictException('Feedback request is already cancelled');
    }

    const updated = await this.prisma.feedbackRequest.update({
      where: { id: requestId },
      data: { status: FeedbackRequestStatus.CANCELLED },
    });

    await this.audit.log({
      action: 'FEEDBACK_REQUEST_CANCELLED',
      actorUserId: userId,
      entityType: 'FeedbackRequest',
      entityId: requestId,
      metadata: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        oldStatus: request.status,
        newStatus: FeedbackRequestStatus.CANCELLED,
      },
      ipAddress: auditMeta?.ipAddress,
      userAgent: auditMeta?.userAgent,
    });

    return updated;
  }

  // ── NPS Summary ──

  async getNpsSummary(
    ctx: { branchId: string; organizationId: string },
    query: NpsSummaryQueryDto,
  ) {
    const now = new Date();
    const windowStart = query.windowStart
      ? new Date(query.windowStart)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const windowEnd = query.windowEnd ? new Date(query.windowEnd) : now;

    // Calculate from raw feedback data
    const feedbacks = await this.prisma.feedback.findMany({
      where: {
        orgId: ctx.organizationId,
        branchId: ctx.branchId,
        submittedAt: { gte: windowStart, lte: windowEnd },
        npsScore: { not: null },
      },
      select: { npsScore: true, npsBucket: true, rating: true, sentiment: true },
    });

    const totalResponses = feedbacks.length;
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    let negativeCount = 0;
    let criticalCount = 0;

    for (const fb of feedbacks) {
      if (fb.npsBucket === NpsBucket.PROMOTER) promoters++;
      else if (fb.npsBucket === NpsBucket.PASSIVE) passives++;
      else if (fb.npsBucket === NpsBucket.DETRACTOR) detractors++;

      if (fb.rating !== null) {
        ratingSum += fb.rating;
        ratingCount++;
      }
      if (fb.sentiment === FeedbackSentiment.NEGATIVE) negativeCount++;
      if (fb.sentiment === FeedbackSentiment.CRITICAL) criticalCount++;
    }

    const npsScore =
      totalResponses > 0 ? (promoters / totalResponses - detractors / totalResponses) * 100 : 0;
    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

    return {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      totalResponses,
      promoters,
      passives,
      detractors,
      npsScore: Math.round(npsScore * 100) / 100,
      avgRating: avgRating !== null ? Math.round(avgRating * 100) / 100 : null,
      negativeCount,
      criticalCount,
    };
  }
}
