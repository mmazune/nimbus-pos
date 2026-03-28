import { IsString, IsOptional, IsEnum } from 'class-validator';
import { FeedbackSource } from '@prisma/client';

export class CreateFeedbackRequestDto {
    @IsOptional()
    @IsString()
    orderId?: string;

    @IsOptional()
    @IsString()
    reservationId?: string;

    @IsOptional()
    @IsString()
    eventId?: string;

    @IsEnum(FeedbackSource)
    source!: FeedbackSource;

    @IsOptional()
    @IsString()
    customerName?: string;

    @IsOptional()
    @IsString()
    customerPhone?: string;

    @IsOptional()
    @IsString()
    customerEmail?: string;

    @IsOptional()
    @IsString()
    expiresAt?: string;
}
