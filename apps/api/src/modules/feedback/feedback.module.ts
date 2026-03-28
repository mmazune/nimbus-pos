import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackPublicController } from './feedback.public.controller';
import { FeedbackService } from './feedback.service';

@Module({
  controllers: [FeedbackController, FeedbackPublicController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
