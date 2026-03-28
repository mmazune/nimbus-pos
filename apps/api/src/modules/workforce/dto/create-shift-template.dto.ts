import {
    IsString,
    IsOptional,
    IsInt,
    Min,
    Max,
    IsBoolean,
    MaxLength,
    Matches,
} from 'class-validator';

export class CreateShiftTemplateDto {
    @IsString()
    @MaxLength(50)
    code!: string;

    @IsString()
    @MaxLength(200)
    name!: string;

    @IsString()
    @Matches(/^\d{2}:\d{2}$/, { message: 'startsAtTime must be HH:mm format' })
    startsAtTime!: string;

    @IsString()
    @Matches(/^\d{2}:\d{2}$/, { message: 'endsAtTime must be HH:mm format' })
    endsAtTime!: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    roleKey?: string;

    @IsOptional()
    @IsString()
    positionId?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    expectedHeadcount?: number;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
