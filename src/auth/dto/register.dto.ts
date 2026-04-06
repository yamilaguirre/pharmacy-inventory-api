import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  /** Role defaults to CASHIER when omitted. Only ADMIN should be able to assign ADMIN role — enforce that at the controller level. */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
