import { IsString, IsOptional, IsEnum, IsNotEmpty, IsBoolean } from 'class-validator';

export enum HqDigestFrequencyDto {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    ON_DEMAND = 'ON_DEMAND',
}

export class CreateDigestSubscriptionDto {
    @IsOptional()
    @IsString()
    channel?: string;

    @IsOptional()
    @IsEnum(HqDigestFrequencyDto)
    frequency?: HqDigestFrequencyDto;

    @IsString()
    @IsNotEmpty()
    digestType!: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    preferences?: Record<string, unknown>;
}

export class UpdateDigestSubscriptionDto {
    @IsOptional()
    @IsEnum(HqDigestFrequencyDto)
    frequency?: HqDigestFrequencyDto;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    preferences?: Record<string, unknown>;
}
