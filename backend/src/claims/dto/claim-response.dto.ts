import { Claim, ClaimStatus } from '../entities/claim.entity';

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

  static fromEntity(entity: Claim): ClaimResponseDto {
    const dto = new ClaimResponseDto();
    dto.id = entity.id;
    dto.storeId = entity.storeId;
    dto.storeName = entity.store?.name || null;
    dto.claimId = entity.claimId;
    dto.orderNumber = entity.orderNumber;
    dto.orderDate = entity.orderDate;
    dto.claimDate = entity.claimDate;
    dto.customerFirstName = entity.customerFirstName;
    dto.customerLastName = entity.customerLastName;
    dto.cargoTrackingNumber = entity.cargoTrackingNumber;
    dto.cargoTrackingLink = entity.cargoTrackingLink;
    dto.cargoSenderNumber = entity.cargoSenderNumber;
    dto.cargoProviderName = entity.cargoProviderName;
    dto.orderShipmentPackageId = entity.orderShipmentPackageId;
    dto.status = entity.status;
    dto.items = entity.items;
    dto.rejectedPackageInfo = entity.rejectedPackageInfo;
    dto.replacementOutboundPackageInfo = entity.replacementOutboundPackageInfo;
    dto.lastModifiedDate = entity.lastModifiedDate;
    dto.orderOutboundPackageId = entity.orderOutboundPackageId;
    dto.isApproved = entity.isApproved;
    dto.approvedAt = entity.approvedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

