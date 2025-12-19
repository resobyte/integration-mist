import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class ApproveClaimDto {
  @IsString()
  claimId: string;

  @IsString()
  storeId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  claimLineItemIds: string[];
}

