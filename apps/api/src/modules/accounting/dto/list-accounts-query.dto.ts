import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';

export class ListAccountsQueryDto {
  @IsOptional()
  @IsEnum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SYSTEM_LOCKED'])
  status?: string;

  @IsOptional()
  @IsString()
  parentAccountId?: string;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
