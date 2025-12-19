import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sellerId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  apiKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  apiSecret?: string;

  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  senderName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  senderAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  senderCity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  senderDistrict?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  senderPhone?: string;
}

