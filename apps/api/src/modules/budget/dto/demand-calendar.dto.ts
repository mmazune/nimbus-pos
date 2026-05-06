import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
  Min,
} from 'class-validator';

export enum DemandCalendarTypeDto {
  BRUNCH = 'BRUNCH',
  SPORTS_NIGHT = 'SPORTS_NIGHT',
  DJ_NIGHT = 'DJ_NIGHT',
  PRIVATE_EVENT = 'PRIVATE_EVENT',
  HOLIDAY_RUSH = 'HOLIDAY_RUSH',
  PROMOTION = 'PROMOTION',
  LARGE_RESERVATION = 'LARGE_RESERVATION',
  CUSTOM = 'CUSTOM',
}

export enum DaypartTypeDto {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  AFTERNOON = 'AFTERNOON',
  DINNER = 'DINNER',
  LATE_NIGHT = 'LATE_NIGHT',
  ALL_DAY = 'ALL_DAY',
}

export class CreateDemandCalendarEntryDto {
  @IsEnum(DemandCalendarTypeDto)
  calendarType!: DemandCalendarTypeDto;

  @IsOptional()
  @IsEnum(DaypartTypeDto)
  daypart?: DaypartTypeDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsDateString()
  dateStart!: string;

  @IsDateString()
  dateEnd!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedCovers?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  demandMultiplier?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  revenueUpliftPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  itemNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  eventId?: string;
}

export class UpdateDemandCalendarEntryDto {
  @IsOptional()
  @IsEnum(DemandCalendarTypeDto)
  calendarType?: DemandCalendarTypeDto;

  @IsOptional()
  @IsEnum(DaypartTypeDto)
  daypart?: DaypartTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsDateString()
  dateStart?: string;

  @IsOptional()
  @IsDateString()
  dateEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedCovers?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  demandMultiplier?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  revenueUpliftPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  itemNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListDemandCalendarQueryDto {
  @IsOptional()
  @IsEnum(DemandCalendarTypeDto)
  calendarType?: DemandCalendarTypeDto;

  @IsOptional()
  @IsEnum(DaypartTypeDto)
  daypart?: DaypartTypeDto;

  @IsOptional()
  @IsDateString()
  dateStart?: string;

  @IsOptional()
  @IsDateString()
  dateEnd?: string;

  @IsOptional()
  @IsString()
  isActive?: string;
}
