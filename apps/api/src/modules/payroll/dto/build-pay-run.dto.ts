import { IsString, IsDateString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class BuildPayRunDto {
    @IsString()
    @MaxLength(200)
    name!: string;

    @IsDateString()
    periodStart!: string;

    @IsDateString()
    periodEnd!: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    employeeIds?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}
