import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateApiKeyDto {
    @IsString()
    name!: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    scopes?: string[];
}
