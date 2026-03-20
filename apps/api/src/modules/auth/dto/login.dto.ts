import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { SessionPlatform } from '@prisma/client';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsEnum(SessionPlatform)
  platform?: SessionPlatform;
}
