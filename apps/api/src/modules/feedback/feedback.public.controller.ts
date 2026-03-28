import { Controller, Get, Post, Body, Param, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { FeedbackService } from './feedback.service';
import { SubmitPublicFeedbackDto } from './dto';

@Controller('feedback/public')
export class FeedbackPublicController {
  // Simple in-memory rate limiter: token -> last submit timestamp
  private readonly submitTimestamps = new Map<string, number>();

  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('token/:token')
  async lookupToken(@Param('token') token: string) {
    return this.feedbackService.lookupToken(token);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(@Body() dto: SubmitPublicFeedbackDto, @Req() req: Request) {
    // Rate limit: same token cannot be submitted more than once per 10 seconds
    const lastSubmit = this.submitTimestamps.get(dto.token);
    if (lastSubmit && Date.now() - lastSubmit < 10_000) {
      return { message: 'Please wait before submitting again', statusCode: 429 };
    }
    this.submitTimestamps.set(dto.token, Date.now());

    // Clean up old entries periodically (keep map bounded)
    if (this.submitTimestamps.size > 10_000) {
      const cutoff = Date.now() - 60_000;
      for (const [k, v] of this.submitTimestamps) {
        if (v < cutoff) this.submitTimestamps.delete(k);
      }
    }

    return this.feedbackService.submitPublicFeedback(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
