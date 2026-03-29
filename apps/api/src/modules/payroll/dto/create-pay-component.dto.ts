import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PayComponentType } from '@prisma/client';

export class CreatePayComponentDto {
    @IsString()
    @MaxLength(50)
    code!: string;

    @IsString()
    @MaxLength(200)
    name!: string;

    @IsEnum(PayComponentType)
    componentType!: PayComponentType;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    calculationMethod?: string;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Type(() => Number)
    defaultAmount?: number;

    @IsOptional()
    @IsBoolean()
    taxable?: boolean;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
