import {
  IsString,
  IsUUID,
  IsNumber,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsUUID()
  storeId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  barcode?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stock: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  purchasePrice?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  salePrice?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  sku?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

