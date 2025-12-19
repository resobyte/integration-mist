import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, TrendyolOrderStatus } from './entities/order.entity';
import { TrendyolApiService } from './trendyol-api.service';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/api-response.interface';
import { OrderResponseDto } from './dto/order-response.dto';

export interface SkippedOrder {
  orderNumber: string;
  shipmentPackageId: number;
  missingBarcodes: string[];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly trendyolApiService: TrendyolApiService,
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
  ) {}

  async fetchAndSaveOrders(storeId: string): Promise<{
    saved: number;
    updated: number;
    errors: number;
    skipped: number;
    skippedOrders: SkippedOrder[];
  }> {
    const store = await this.storesService.findOne(storeId);
    
    if (!store.sellerId) {
      throw new NotFoundException('Store sellerId not found');
    }

    if (!store.apiKey || !store.apiSecret) {
      throw new NotFoundException('Store API Key or API Secret not found');
    }

    const params = {
      size: 200,
      orderByField: 'PackageLastModifiedDate',
      orderByDirection: 'DESC' as const,
      status: TrendyolOrderStatus.CREATED,
    };

    let page = 0;
    let totalPages = 1;
    let saved = 0;
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    const skippedOrders: SkippedOrder[] = [];

    while (page < totalPages) {
      try {
        const response = await this.trendyolApiService.getOrders(
          store.sellerId,
          store.apiKey,
          store.apiSecret,
          { ...params, page },
        );

        totalPages = response.totalPages;

        for (const trendyolOrder of response.content) {
          try {
            const orderBarcodes = this.extractBarcodesFromLines(trendyolOrder.lines);
            
            if (orderBarcodes.length > 0) {
              const existingBarcodes = await this.productsService.getExistingBarcodes(orderBarcodes);
              const missingBarcodes = orderBarcodes.filter((b) => !existingBarcodes.has(b));

              if (missingBarcodes.length > 0) {
                skipped++;
                skippedOrders.push({
                  orderNumber: trendyolOrder.orderNumber,
                  shipmentPackageId: trendyolOrder.shipmentPackageId,
                  missingBarcodes,
                });
                continue;
              }
            }

            const existingOrder = await this.orderRepository.findOne({
              where: { shipmentPackageId: trendyolOrder.shipmentPackageId },
            });

            const orderData = {
              storeId: store.id,
              orderNumber: trendyolOrder.orderNumber,
              shipmentPackageId: trendyolOrder.shipmentPackageId,
              trendyolCustomerId: trendyolOrder.customerId,
              supplierId: trendyolOrder.supplierId,
              trendyolStatus: trendyolOrder.shipmentPackageStatus || trendyolOrder.status,
              status: this.mapTrendyolStatusToOrderStatus(trendyolOrder.shipmentPackageStatus || trendyolOrder.status),
              customerFirstName: trendyolOrder.customerFirstName,
              customerLastName: trendyolOrder.customerLastName,
              customerEmail: trendyolOrder.customerEmail,
              orderDate: trendyolOrder.orderDate,
              grossAmount: trendyolOrder.packageGrossAmount || trendyolOrder.grossAmount,
              totalPrice: trendyolOrder.packageTotalPrice || trendyolOrder.totalPrice,
              currencyCode: trendyolOrder.currencyCode,
              cargoTrackingNumber: trendyolOrder.cargoTrackingNumber,
              cargoProviderName: trendyolOrder.cargoProviderName,
              cargoTrackingLink: trendyolOrder.cargoTrackingLink,
              shipmentAddress: trendyolOrder.shipmentAddress,
              invoiceAddress: trendyolOrder.invoiceAddress,
              lines: trendyolOrder.lines,
              packageHistories: trendyolOrder.packageHistories,
              commercial: trendyolOrder.commercial || false,
              micro: trendyolOrder.micro || false,
              deliveryAddressType: trendyolOrder.deliveryAddressType,
              lastModifiedDate: trendyolOrder.lastModifiedDate,
            };

            if (existingOrder) {
              Object.assign(existingOrder, orderData);
              await this.orderRepository.save(existingOrder);
              updated++;
            } else {
              const newOrder = this.orderRepository.create(orderData);
              await this.orderRepository.save(newOrder);
              saved++;
            }
          } catch (error) {
            errors++;
            console.error(`Error saving order ${trendyolOrder.orderNumber}:`, error);
          }
        }

        page++;
      } catch (error) {
        errors++;
        console.error(`Error fetching page ${page}:`, error);
        break;
      }
    }

    return { saved, updated, errors, skipped, skippedOrders };
  }

  private extractBarcodesFromLines(lines: Record<string, unknown>[] | undefined): string[] {
    if (!lines || !Array.isArray(lines)) {
      return [];
    }

    return lines
      .map((line: any) => line.barcode || line.productBarcode)
      .filter((barcode): barcode is string => Boolean(barcode));
  }

  private mapTrendyolStatusToOrderStatus(trendyolStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'Awaiting': OrderStatus.PENDING,
      'Created': OrderStatus.PENDING,
      'Picking': OrderStatus.PROCESSING,
      'Invoiced': OrderStatus.PROCESSING,
      'Shipped': OrderStatus.SHIPPED,
      'Delivered': OrderStatus.DELIVERED,
      'Cancelled': OrderStatus.CANCELLED,
      'UnSupplied': OrderStatus.CANCELLED,
      'Returned': OrderStatus.RETURNED,
      'UnDelivered': OrderStatus.PROCESSING,
      'AtCollectionPoint': OrderStatus.SHIPPED,
      'UnPacked': OrderStatus.PROCESSING,
    };

    return statusMap[trendyolStatus] || OrderStatus.PENDING;
  }

  async findAll(
    paginationDto: PaginationDto,
    storeId?: string,
    status?: OrderStatus,
    excludeStatuses?: OrderStatus[],
  ): Promise<PaginationResponse<OrderResponseDto>> {
    const { page, limit, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.store', 'store');

    if (excludeStatuses && excludeStatuses.length > 0) {
      queryBuilder.where('order.status NOT IN (:...excludeStatuses)', { excludeStatuses });
    }

    if (storeId) {
      if (excludeStatuses && excludeStatuses.length > 0) {
        queryBuilder.andWhere('order.storeId = :storeId', { storeId });
      } else {
        queryBuilder.where('order.storeId = :storeId', { storeId });
      }
    }

    if (status) {
      if (storeId || (excludeStatuses && excludeStatuses.length > 0)) {
        queryBuilder.andWhere('order.status = :status', { status });
      } else {
        queryBuilder.where('order.status = :status', { status });
      }
    }

    if (sortBy) {
      queryBuilder.orderBy(`order.${sortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy('order.orderDate', 'DESC');
    }

    const [orders, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: orders.map((o) => OrderResponseDto.fromEntity(o, true)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['store'],
      withDeleted: false,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return OrderResponseDto.fromEntity(order, true);
  }

  async fetchAllStoresOrders(): Promise<{
    totalStores: number;
    results: Array<{
      storeId: string;
      storeName: string;
      saved: number;
      updated: number;
      errors: number;
      skipped: number;
      skippedOrders: SkippedOrder[];
      error?: string;
    }>;
  }> {
    const storesResponse = await this.storesService.findAll(
      { page: 1, limit: 1000, sortBy: 'createdAt', sortOrder: 'ASC' },
    );

    const stores = storesResponse.data.filter(
      (store) => store.sellerId && store.apiKey && store.apiSecret && store.isActive,
    );

    const results = [];

    for (const store of stores) {
      try {
        const result = await this.fetchAndSaveOrders(store.id);
        results.push({
          storeId: store.id,
          storeName: store.name,
          saved: result.saved,
          updated: result.updated,
          errors: result.errors,
          skipped: result.skipped,
          skippedOrders: result.skippedOrders,
        });
      } catch (error) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          saved: 0,
          updated: 0,
          errors: 1,
          skipped: 0,
          skippedOrders: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalStores: stores.length,
      results,
    };
  }
}

