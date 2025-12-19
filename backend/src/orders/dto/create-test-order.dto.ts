import { IsString, IsEmail, IsArray, ValidateNested, IsInt, Min, IsUUID, IsOptional, IsNotEmpty, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class TestOrderLineDto {
  @IsString()
  @IsNotEmpty()
  productBarcode: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  discountPercentage?: number;
}

export class CreateTestOrderDto {
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  customerFirstName: string;

  @IsString()
  @IsNotEmpty()
  customerLastName: string;

  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsNotEmpty()
  addressText: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  latitude?: string;

  @IsString()
  @IsOptional()
  longitude?: string;

  @IsBoolean()
  @IsOptional()
  commercial?: boolean;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  invoiceTaxNumber?: string;

  @IsString()
  @IsOptional()
  invoiceTaxOffice?: string;

  @IsString()
  @IsOptional()
  microRegion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestOrderLineDto)
  lines: TestOrderLineDto[];
}

