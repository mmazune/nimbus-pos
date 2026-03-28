import { IsString, IsOptional, IsInt, Min, Max, IsEnum, MaxLength, Matches } from 'class-validator';

export class CreateCoverageRuleDto {
    @IsString()
    @MaxLength(200)
    name!: string;

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
    minimumHeadcount?: number;

    @IsOptional()
    @IsString()
    @Matches(/^\d{2}:\d{2}$/, { message: 'appliesFromTime must be HH:mm format' })
    appliesFromTime?: string;

    @IsOptional()
    @IsString()
    @Matches(/^\d{2}:\d{2}$/, { message: 'appliesToTime must be HH:mm format' })
    appliesToTime?: string;

    @IsOptional()
    @IsEnum(['ACTIVE', 'INACTIVE'])
    status?: string;

    @IsOptional()
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    severity?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
