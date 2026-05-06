import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';

export enum AccountStatusFilterEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AccountTypeFilterEnum {
  CORPORATE = 'CORPORATE',
  HOUSE = 'HOUSE',
  INDIVIDUAL = 'INDIVIDUAL',
}

export class ListAccountsQueryDto {
  @IsOptional()
  @IsEnum(AccountStatusFilterEnum)
  status?: AccountStatusFilterEnum;

  @IsOptional()
  @IsEnum(AccountTypeFilterEnum)
  type?: AccountTypeFilterEnum;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsNumberString()
  skip?: string;

  @IsOptional()
  @IsNumberString()
  take?: string;
}
