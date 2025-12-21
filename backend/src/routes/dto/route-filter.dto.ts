import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class RouteFilterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').filter(Boolean);
    }
    if (Array.isArray(value)) {
      return value;
    }
    return value;
  })
  productBarcodes?: string[];

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minOrderCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxOrderCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minTotalQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxTotalQuantity?: number;
}

