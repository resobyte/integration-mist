import { IsOptional, IsArray, IsString, IsDateString } from 'class-validator';

export class ReportFilterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeIds?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}








