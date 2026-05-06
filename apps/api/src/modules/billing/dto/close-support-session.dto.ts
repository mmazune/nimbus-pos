import { IsOptional, IsString } from 'class-validator';

export class CloseSupportSessionDto {
    @IsOptional()
    @IsString()
    closedReason?: string;
}
