import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackStatus, FeedbackSentiment, FeedbackSource } from '@prisma/client';

export class ListFeedbackQueryDto {
    @IsOptional()
    @IsEnum(FeedbackStatus)
    status?: FeedbackStatus;

    @IsOptional()
    @IsEnum(FeedbackSentiment)
    sentiment?: FeedbackSentiment;

    @IsOptional()
    @IsEnum(FeedbackSource)
    source?: FeedbackSource;

    @IsOptional()
    @IsString()
    orderId?: string;

    @IsOptional()
    @IsString()
    reservationId?: string;

    @IsOptional()
    @IsString()
    eventId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    take?: number;
}
