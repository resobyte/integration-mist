import { ClaimStatus } from '../enums/claim-status.enum';

export class ClaimResponseDto {
  id: string;
  storeId: string;
  storeName: string | null;
  claimId: string;
  orderNumber: string;
  orderDate: number | null;
  claimDate: number | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  cargoTrackingNumber: string | null;
  cargoTrackingLink: string | null;
  cargoSenderNumber: string | null;
  cargoProviderName: string | null;
  orderShipmentPackageId: number | null;
  status: ClaimStatus;
  items: Record<string, unknown>[] | null;
  rejectedPackageInfo: Record<string, unknown> | null;
  replacementOutboundPackageInfo: Record<string, unknown> | null;
  lastModifiedDate: number | null;
  orderOutboundPackageId: number | null;
  isApproved: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

