import {
  Injectable,
  NotFoundException,
  Logger,
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
  private readonly logger = new Logger(OrdersService.name);

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
          store.proxyUrl || undefined,
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
              agreedDeliveryDate: trendyolOrder.agreedDeliveryDate || null,
              isActive: store.isActive,
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
    search?: string,
    overdue?: boolean,
  ): Promise<PaginationResponse<OrderResponseDto>> {
    const { page, limit, sortBy, sortOrder } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.store', 'store')
      .where('store.isActive = :storeIsActive', { storeIsActive: true })
      .andWhere('order.isActive = :orderIsActive', { orderIsActive: true });

    if (excludeStatuses && excludeStatuses.length > 0) {
      queryBuilder.andWhere('order.status NOT IN (:...excludeStatuses)', { excludeStatuses });
    }

    if (storeId) {
      queryBuilder.andWhere('order.storeId = :storeId', { storeId });
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(order.orderNumber) LIKE :search OR LOWER(order.customerFirstName) LIKE :search OR LOWER(order.customerLastName) LIKE :search OR LOWER(order.customerEmail) LIKE :search)',
        { search: searchTerm },
      );
    }

    if (overdue) {
      // Gecikmiş kargo: agreedDeliveryDate bugünden küçük ve status SHIPPED, DELIVERED, CANCELLED değil
      // agreedDeliveryDate GMT+3 formatında timestamp olarak gelir
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // GMT+3'e göre bugünün başlangıcı timestamp'i
      const todayStartUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
      const todayStartGMT3 = todayStartUTC.getTime() + (3 * 60 * 60 * 1000);

      queryBuilder
        .andWhere('order.agreedDeliveryDate IS NOT NULL')
        .andWhere('order.agreedDeliveryDate < :todayStart', { todayStart: todayStartGMT3 })
        .andWhere('order.status NOT IN (:...excludedStatuses)', {
          excludedStatuses: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        });
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

  async getCount(status?: OrderStatus): Promise<number> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.store', 'store')
      .where('store.isActive = :storeIsActive', { storeIsActive: true })
      .andWhere('order.isActive = :orderIsActive', { orderIsActive: true });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    return queryBuilder.getCount();
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

  async syncCreatedOrders(storeId: string): Promise<{
    initialSync: boolean;
    initialSyncSaved: number;
    trendyolCreatedCount: number;
    dbCreatedCount: number;
    newOrdersAdded: number;
    ordersUpdated: number;
    ordersSkipped: number;
    errors: number;
  }> {
    const store = await this.storesService.findOne(storeId);
    
    if (!store.sellerId) {
      throw new NotFoundException('Store sellerId not found');
    }

    if (!store.apiKey || !store.apiSecret) {
      throw new NotFoundException('Store API Key or API Secret not found');
    }

    const existingOrdersCount = await this.orderRepository.count({
      where: { storeId },
    });

    let initialSync = false;
    let initialSyncSaved = 0;

    if (existingOrdersCount === 0) {
      this.logger.log(`No orders found for store ${store.name}. Performing initial sync with all statuses...`);
      initialSync = true;

      try {
        const initialSyncResult = await this.fetchAndSaveOrders(storeId);
        initialSyncSaved = initialSyncResult.saved;
        this.logger.log(`Initial sync completed. Saved ${initialSyncSaved} orders with all statuses.`);
      } catch (error) {
        this.logger.error(`Error during initial sync: ${error.message}`, error.stack);
        throw error;
      }
    }

    const params = {
      size: 200,
      orderByField: 'PackageLastModifiedDate',
      orderByDirection: 'DESC' as const,
      status: TrendyolOrderStatus.CREATED,
    };

    const trendyolCreatedOrders: Map<number, any> = new Map();
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      try {
        const response = await this.trendyolApiService.getOrders(
          store.sellerId,
          store.apiKey,
          store.apiSecret,
          { ...params, page },
          store.proxyUrl || undefined,
        );

        totalPages = response.totalPages;

        for (const trendyolOrder of response.content) {
          trendyolCreatedOrders.set(trendyolOrder.shipmentPackageId, trendyolOrder);
        }

        page++;
      } catch (error) {
        this.logger.error(`Error fetching CREATED orders from Trendyol: ${error.message}`, error.stack);
        break;
      }
    }

    const dbCreatedOrders = await this.orderRepository.find({
      where: {
        storeId,
        status: OrderStatus.PENDING,
      },
    });

    const trendyolPackageIds = new Set(trendyolCreatedOrders.keys());
    const dbPackageIds = new Set(dbCreatedOrders.map((o) => o.shipmentPackageId));

    const newPackageIds = new Set(
      Array.from(trendyolPackageIds).filter((id) => !dbPackageIds.has(id))
    );
    const missingPackageIds = new Set(
      Array.from(dbPackageIds).filter((id) => !trendyolPackageIds.has(id))
    );

    let newOrdersAdded = 0;
    let ordersUpdated = 0;
    let ordersSkipped = 0;
    let errors = 0;

    for (const packageId of newPackageIds) {
      try {
        const trendyolOrder = trendyolCreatedOrders.get(packageId);
        if (!trendyolOrder) continue;

        const orderBarcodes = this.extractBarcodesFromLines(trendyolOrder.lines);
        
        if (orderBarcodes.length > 0) {
          const existingBarcodes = await this.productsService.getExistingBarcodes(orderBarcodes);
          const missingBarcodes = orderBarcodes.filter((b) => !existingBarcodes.has(b));

          if (missingBarcodes.length > 0) {
            ordersSkipped++;
            continue;
          }
        }

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
          agreedDeliveryDate: trendyolOrder.agreedDeliveryDate || null,
          isActive: store.isActive,
        };

        const newOrder = this.orderRepository.create(orderData);
        await this.orderRepository.save(newOrder);
        newOrdersAdded++;
      } catch (error) {
        errors++;
        this.logger.error(`Error adding new order ${packageId}: ${error.message}`, error.stack);
      }
    }

    for (const packageId of missingPackageIds) {
      try {
        const dbOrder = dbCreatedOrders.find((o) => o.shipmentPackageId === packageId);
        if (!dbOrder) continue;

        const trendyolOrder = await this.trendyolApiService.getOrderByPackageId(
          store.sellerId,
          store.apiKey,
          store.apiSecret,
          packageId,
          store.proxyUrl || undefined,
        );

        if (!trendyolOrder) {
          this.logger.warn(`Order ${dbOrder.orderNumber} (packageId: ${packageId}) not found in Trendyol`);
          continue;
        }

        const orderBarcodes = this.extractBarcodesFromLines(trendyolOrder.lines);
        
        if (orderBarcodes.length > 0) {
          const existingBarcodes = await this.productsService.getExistingBarcodes(orderBarcodes);
          const missingBarcodes = orderBarcodes.filter((b) => !existingBarcodes.has(b));

          if (missingBarcodes.length > 0) {
            this.logger.warn(`Order ${dbOrder.orderNumber} has missing barcodes, skipping update`);
            continue;
          }
        }

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
          agreedDeliveryDate: trendyolOrder.agreedDeliveryDate || null,
          isActive: store.isActive,
        };

        Object.assign(dbOrder, orderData);
        await this.orderRepository.save(dbOrder);
        ordersUpdated++;

        if (ordersUpdated % 10 === 0) {
          this.logger.log(`Updated ${ordersUpdated}/${missingPackageIds.size} orders...`);
        }
      } catch (error) {
        errors++;
        this.logger.error(`Error updating order ${packageId}: ${error.message}`, error.stack);
      }
    }

    this.logger.log(
      `CREATED sync completed: Trendyol CREATED: ${trendyolCreatedOrders.size}, DB CREATED: ${dbCreatedOrders.length}, ` +
      `New: ${newOrdersAdded}, Updated: ${ordersUpdated}, Skipped: ${ordersSkipped}, Errors: ${errors}`
    );

    return {
      initialSync,
      initialSyncSaved,
      trendyolCreatedCount: trendyolCreatedOrders.size,
      dbCreatedCount: dbCreatedOrders.length,
      newOrdersAdded,
      ordersUpdated,
      ordersSkipped,
      errors,
    };
  }

  async syncExistingOrders(
    storeId: string,
    status?: OrderStatus,
  ): Promise<{
    total: number;
    updated: number;
    notFound: number;
    errors: number;
  }> {
    const store = await this.storesService.findOne(storeId);
    
    if (!store.sellerId) {
      throw new NotFoundException('Store sellerId not found');
    }

    if (!store.apiKey || !store.apiSecret) {
      throw new NotFoundException('Store API Key or API Secret not found');
    }

    const where: any = { storeId };
    if (status) {
      where.status = status;
    }

    const existingOrders = await this.orderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    this.logger.log(`Syncing ${existingOrders.length} existing orders for store ${store.name}`);

    for (const order of existingOrders) {
      try {
        const trendyolOrder = await this.trendyolApiService.getOrderByPackageId(
          store.sellerId,
          store.apiKey,
          store.apiSecret,
          order.shipmentPackageId,
          store.proxyUrl || undefined,
        );

        if (!trendyolOrder) {
          notFound++;
          this.logger.warn(`Order ${order.orderNumber} (packageId: ${order.shipmentPackageId}) not found in Trendyol`);
          continue;
        }

        const orderBarcodes = this.extractBarcodesFromLines(trendyolOrder.lines);
        
        if (orderBarcodes.length > 0) {
          const existingBarcodes = await this.productsService.getExistingBarcodes(orderBarcodes);
          const missingBarcodes = orderBarcodes.filter((b) => !existingBarcodes.has(b));

          if (missingBarcodes.length > 0) {
            this.logger.warn(`Order ${order.orderNumber} has missing barcodes, skipping update`);
            continue;
          }
        }

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
          agreedDeliveryDate: trendyolOrder.agreedDeliveryDate || null,
          isActive: store.isActive,
        };

        Object.assign(order, orderData);
        await this.orderRepository.save(order);
        updated++;

        if (updated % 10 === 0) {
          this.logger.log(`Synced ${updated}/${existingOrders.length} orders...`);
        }
      } catch (error) {
        errors++;
        this.logger.error(`Error syncing order ${order.orderNumber}: ${error.message}`, error.stack);
      }
    }

    this.logger.log(`Sync completed: ${updated} updated, ${notFound} not found, ${errors} errors`);

    return {
      total: existingOrders.length,
      updated,
      notFound,
      errors,
    };
  }

  async syncAllStoresCreatedOrders(): Promise<{
    totalStores: number;
    results: Array<{
      storeId: string;
      storeName: string;
      initialSync: boolean;
      initialSyncSaved: number;
      trendyolCreatedCount: number;
      dbCreatedCount: number;
      newOrdersAdded: number;
      ordersUpdated: number;
      ordersSkipped: number;
      errors: number;
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
        const result = await this.syncCreatedOrders(store.id);
        results.push({
          storeId: store.id,
          storeName: store.name,
          initialSync: result.initialSync,
          initialSyncSaved: result.initialSyncSaved,
          trendyolCreatedCount: result.trendyolCreatedCount,
          dbCreatedCount: result.dbCreatedCount,
          newOrdersAdded: result.newOrdersAdded,
          ordersUpdated: result.ordersUpdated,
          ordersSkipped: result.ordersSkipped,
          errors: result.errors,
        });
      } catch (error) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          initialSync: false,
          initialSyncSaved: 0,
          trendyolCreatedCount: 0,
          dbCreatedCount: 0,
          newOrdersAdded: 0,
          ordersUpdated: 0,
          ordersSkipped: 0,
          errors: 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalStores: stores.length,
      results,
    };
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

