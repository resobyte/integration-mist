import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class RouteFilterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    if (typeof value === 'string') {
      return [Number(value)];
    }
    return value;
  })
  quantities?: number[];

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

