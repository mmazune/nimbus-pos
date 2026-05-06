import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';

export enum ForecastTypeFilterDto {
  BRANCH = 'BRANCH',
  ROLLUP = 'ROLLUP',
  FRANCHISE = 'FRANCHISE',
}

export enum ForecastHorizonDto {
  TODAY = 'TODAY',
  THREE_DAY = 'THREE_DAY',
  SEVEN_DAY = 'SEVEN_DAY',
}

export class ListForecastQueryDto {
  @IsOptional()
  @IsEnum(ForecastTypeFilterDto)
  forecastType?: ForecastTypeFilterDto;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @IsDateString()
  sourceWindowStart?: string;

  @IsOptional()
  @IsDateString()
  sourceWindowEnd?: string;

  @IsOptional()
  @IsEnum(ForecastHorizonDto)
  horizon?: ForecastHorizonDto;

  @IsOptional()
  @IsString()
  refresh?: string;
}
