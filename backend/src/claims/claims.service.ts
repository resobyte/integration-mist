import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimStatus } from './entities/claim.entity';
import { Store } from '../stores/entities/store.entity';
import { TrendyolClaimsApiService } from './trendyol-claims-api.service';
import { ClaimResponseDto } from './dto/claim-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly trendyolClaimsApiService: TrendyolClaimsApiService,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<{
    data: ClaimResponseDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const stores = await this.storeRepository.find({
      where: { isActive: true },
    });

    const activeStores = stores.filter(
      (store) => store.sellerId && store.apiKey && store.apiSecret,
    );

    const allClaims: ClaimResponseDto[] = [];

    for (const store of activeStores) {
      try {
        const trendyolClaims = await this.trendyolClaimsApiService.getAllClaims(
          store.sellerId!,
          store.apiKey!,
          store.apiSecret!,
        );

        for (const trendyolClaim of trendyolClaims) {
          const claimStatus = this.mapClaimStatus(trendyolClaim.items);

          const dto = new ClaimResponseDto();
          dto.id = `${store.id}-${trendyolClaim.claimId}`;
          dto.storeId = store.id;
          dto.storeName = store.name;
          dto.claimId = trendyolClaim.claimId;
          dto.orderNumber = trendyolClaim.orderNumber;
          dto.orderDate = trendyolClaim.orderDate;
          dto.claimDate = trendyolClaim.claimDate;
          dto.customerFirstName = trendyolClaim.customerFirstName;
          dto.customerLastName = trendyolClaim.customerLastName;
          dto.cargoTrackingNumber = trendyolClaim.cargoTrackingNumber?.toString() || null;
          dto.cargoTrackingLink = trendyolClaim.cargoTrackingLink;
          dto.cargoSenderNumber = trendyolClaim.cargoSenderNumber;
          dto.cargoProviderName = trendyolClaim.cargoProviderName;
          dto.orderShipmentPackageId = trendyolClaim.orderShipmentPackageId;
          dto.status = claimStatus;
          dto.items = trendyolClaim.items as unknown as Record<string, unknown>[];
          dto.rejectedPackageInfo = (trendyolClaim.rejectedpackageinfo as Record<string, unknown>) || null;
          dto.replacementOutboundPackageInfo = (trendyolClaim.replacementOutboundpackageinfo as Record<string, unknown>) || null;
          dto.lastModifiedDate = trendyolClaim.lastModifiedDate;
          dto.orderOutboundPackageId = trendyolClaim.orderOutboundPackageId;
          dto.isApproved = false;
          dto.approvedAt = null;
          dto.createdAt = new Date(trendyolClaim.claimDate);
          dto.updatedAt = new Date(trendyolClaim.lastModifiedDate);

          allClaims.push(dto);
        }
      } catch (error) {
        this.logger.error(`Error fetching claims for store ${store.name}:`, error);
      }
    }

    const { page = 1, limit = 10, sortBy = 'claimDate', sortOrder = 'DESC' } = paginationDto;

    allClaims.sort((a, b) => {
      const aValue = a[sortBy as keyof ClaimResponseDto];
      const bValue = b[sortBy as keyof ClaimResponseDto];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });

    const total = allClaims.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedClaims = allClaims.slice(startIndex, endIndex);

    return {
      data: paginatedClaims,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<ClaimResponseDto> {
    const [storeId, claimId] = id.split('-', 2);
    
    if (!storeId || !claimId) {
      throw new NotFoundException('Invalid claim ID format');
    }

    const store = await this.storeRepository.findOne({ where: { id: storeId } });

    if (!store || !store.sellerId || !store.apiKey || !store.apiSecret) {
      throw new NotFoundException('Store not found or credentials not configured');
    }

    const trendyolClaims = await this.trendyolClaimsApiService.getAllClaims(
      store.sellerId,
      store.apiKey,
      store.apiSecret,
    );

    const trendyolClaim = trendyolClaims.find((c) => c.claimId === claimId);

    if (!trendyolClaim) {
      throw new NotFoundException('Claim not found');
    }

    const claimStatus = this.mapClaimStatus(trendyolClaim.items);

    const dto = new ClaimResponseDto();
    dto.id = id;
    dto.storeId = store.id;
    dto.storeName = store.name;
    dto.claimId = trendyolClaim.claimId;
    dto.orderNumber = trendyolClaim.orderNumber;
    dto.orderDate = trendyolClaim.orderDate;
    dto.claimDate = trendyolClaim.claimDate;
    dto.customerFirstName = trendyolClaim.customerFirstName;
    dto.customerLastName = trendyolClaim.customerLastName;
    dto.cargoTrackingNumber = trendyolClaim.cargoTrackingNumber?.toString() || null;
    dto.cargoTrackingLink = trendyolClaim.cargoTrackingLink;
    dto.cargoSenderNumber = trendyolClaim.cargoSenderNumber;
    dto.cargoProviderName = trendyolClaim.cargoProviderName;
    dto.orderShipmentPackageId = trendyolClaim.orderShipmentPackageId;
    dto.status = claimStatus;
    dto.items = trendyolClaim.items as unknown as Record<string, unknown>[];
    dto.rejectedPackageInfo = (trendyolClaim.rejectedpackageinfo as Record<string, unknown>) || null;
    dto.replacementOutboundPackageInfo = (trendyolClaim.replacementOutboundpackageinfo as Record<string, unknown>) || null;
    dto.lastModifiedDate = trendyolClaim.lastModifiedDate;
    dto.orderOutboundPackageId = trendyolClaim.orderOutboundPackageId;
    dto.isApproved = false;
    dto.approvedAt = null;
    dto.createdAt = new Date(trendyolClaim.claimDate);
    dto.updatedAt = new Date(trendyolClaim.lastModifiedDate);

    return dto;
  }

  async approveClaim(claimId: string, storeId: string, claimLineItemIds: string[]): Promise<{ success: boolean; message: string }> {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (!store.sellerId || !store.apiKey || !store.apiSecret) {
      throw new BadRequestException('Store Trendyol credentials not configured');
    }

    if (claimLineItemIds.length === 0) {
      throw new BadRequestException('No claim line items found to approve');
    }

    await this.trendyolClaimsApiService.approveClaim(
      store.sellerId,
      store.apiKey,
      store.apiSecret,
      claimId,
      claimLineItemIds,
    );

    return {
      success: true,
      message: 'İade başarıyla onaylandı',
    };
  }

  private mapClaimStatus(items: unknown[]): ClaimStatus {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ClaimStatus.CREATED;
    }

    const firstItem = items[0] as { claimItems?: { claimItemStatus?: { name?: string } }[] };
    const statusName = firstItem?.claimItems?.[0]?.claimItemStatus?.name;

    switch (statusName) {
      case 'Created':
        return ClaimStatus.CREATED;
      case 'WaitingInAction':
        return ClaimStatus.WAITING_IN_ACTION;
      case 'WaitingFraudCheck':
        return ClaimStatus.WAITING_FRAUD_CHECK;
      case 'Accepted':
        return ClaimStatus.ACCEPTED;
      case 'Cancelled':
        return ClaimStatus.CANCELLED;
      case 'Rejected':
        return ClaimStatus.REJECTED;
      case 'Unresolved':
        return ClaimStatus.UNRESOLVED;
      case 'InAnalysis':
        return ClaimStatus.IN_ANALYSIS;
      default:
        return ClaimStatus.CREATED;
    }
  }

  private extractClaimLineItemIds(items: Record<string, unknown>[] | null): string[] {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    const ids: string[] = [];

    for (const item of items) {
      const claimItems = item.claimItems as { id?: string }[] | undefined;
      if (claimItems && Array.isArray(claimItems)) {
        for (const claimItem of claimItems) {
          if (claimItem.id) {
            ids.push(claimItem.id);
          }
        }
      }
    }

    return ids;
  }
}

