import { IsOptional, IsString } from 'class-validator';

export class ResolveFeedbackDto {
    @IsOptional()
    @IsString()
    resolutionNotes?: string;
}
