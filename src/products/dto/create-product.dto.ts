import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDecimal,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(2)
  sku: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsDecimal({ decimal_digits: '0,2' })
  @Type(() => String)
  price: string;

  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsUUID()
  categoryId: string;
}
