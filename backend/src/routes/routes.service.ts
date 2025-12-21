import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { Route, RouteStatus } from './entities/route.entity';
import { RouteOrder } from './entities/route-order.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteFilterDto } from './dto/route-filter.dto';
import { RouteResponseDto } from './dto/route-response.dto';
import { OrdersService } from '../orders/orders.service';
import { TrendyolApiService } from '../orders/trendyol-api.service';
import { ZplLabelService } from './zpl-label.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginationResponse } from '../common/interfaces/api-response.interface';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(RouteOrder)
    private readonly routeOrderRepository: Repository<RouteOrder>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly ordersService: OrdersService,
    private readonly trendyolApiService: TrendyolApiService,
    private readonly zplLabelService: ZplLabelService,
  ) {}

  async create(createRouteDto: CreateRouteDto): Promise<RouteResponseDto> {
    const orders = await this.orderRepository.find({
      where: { id: In(createRouteDto.orderIds) },
      relations: ['store'],
    });

    if (orders.length !== createRouteDto.orderIds.length) {
      throw new BadRequestException('Some orders not found');
    }

    const route = this.routeRepository.create({
      name: createRouteDto.name,
      description: createRouteDto.description,
      status: RouteStatus.COLLECTING,
    });

    route.id = randomUUID();

    const savedRoute = await this.routeRepository.save(route);

    for (const order of orders) {
      const routeOrder = this.routeOrderRepository.create({
        routeId: savedRoute.id,
        orderId: order.id,
      });
      await this.routeOrderRepository.save(routeOrder);

      if (order.status !== OrderStatus.COLLECTING && order.status !== OrderStatus.PACKED) {
        await this.orderRepository.update(order.id, {
          status: OrderStatus.COLLECTING,
        });
      }
    }

    const fullRoute = await this.routeRepository.findOne({
      where: { id: savedRoute.id },
      relations: ['orders', 'orders.store'],
    });

    return RouteResponseDto.fromEntity(fullRoute!, true);
  }

  async findAll(status?: RouteStatus[]): Promise<RouteResponseDto[]> {
    const where: any = {};
    
    if (status && status.length > 0) {
      where.status = In(status);
    }

    const routes = await this.routeRepository.find({
      where,
      relations: ['orders', 'orders.store'],
      order: { createdAt: 'DESC' },
    });

    return routes.map((route) => RouteResponseDto.fromEntity(route, true));
  }

  async findOne(id: string): Promise<RouteResponseDto> {
    const route = await this.routeRepository.findOne({
      where: { id },
      relations: ['orders', 'orders.store'],
      withDeleted: false,
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return RouteResponseDto.fromEntity(route, true);
  }

  async getFilteredOrders(filter: RouteFilterDto): Promise<any[]> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.store', 'store')
      .where('order.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [OrderStatus.COLLECTING, OrderStatus.PACKED],
      });

    if (filter.storeId) {
      queryBuilder.andWhere('order.storeId = :storeId', { storeId: filter.storeId });
    }

    if (filter.status) {
      queryBuilder.andWhere('order.status = :status', { status: filter.status });
    }

    const orders = await queryBuilder.getMany();

    let filteredOrders = orders;

    if (filter.productIds && filter.productIds.length > 0) {
      filteredOrders = orders.filter((order) => {
        if (!order.lines || !Array.isArray(order.lines)) return false;

        const orderBarcodes = order.lines
          .map((line: any) => line.barcode || line.productBarcode)
          .filter(Boolean);

        return filter.productIds!.some((productId) => orderBarcodes.includes(productId));
      });
    }

    if (filter.quantities && filter.quantities.length > 0) {
      filteredOrders = filteredOrders.filter((order) => {
        if (!order.lines || !Array.isArray(order.lines)) return false;

        const orderQuantities = order.lines.map((line: any) => line.quantity || 0);

        return filter.quantities!.some((qty) => orderQuantities.includes(qty));
      });
    }

    return filteredOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      store: order.store ? { id: order.store.id, name: order.store.name } : null,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      shipmentAddress: order.shipmentAddress,
      lines: order.lines,
      cargoTrackingNumber: order.cargoTrackingNumber,
      status: order.status,
    }));
  }

  async printLabel(routeId: string): Promise<{ zpl: string; route: RouteResponseDto }> {
    const route = await this.routeRepository.findOne({
      where: { id: routeId },
      relations: ['orders', 'orders.store'],
      withDeleted: false,
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.status === RouteStatus.COMPLETED) {
      throw new BadRequestException('Route already completed');
    }

    const zpl = await this.zplLabelService.generateZpl(route);

    await this.routeRepository.update(routeId, {
      status: RouteStatus.COMPLETED,
      labelPrintedAt: new Date().toISOString(),
    });

    for (const order of route.orders) {
      await this.orderRepository.update(order.id, {
        status: OrderStatus.PACKED,
      });

      // Trendyol'a Picking status'ü gönderme kısmı yorum satırına alındı
      /*
      if (order.store?.sellerId && order.store?.apiKey && order.store?.apiSecret) {
        try {
          const lines = order.lines as Array<Record<string, unknown>> | null;
          
          if (lines && lines.length > 0) {
            const packageLines = lines
              .map((line) => {
                const lineId = line.id || line.lineId || line.orderLineId;
                const quantity = line.quantity || 1;
                
                if (lineId && typeof lineId === 'number' && lineId > 0) {
                  return {
                    lineId: lineId as number,
                    quantity: typeof quantity === 'number' ? quantity : parseInt(String(quantity), 10) || 1,
                  };
                }
                return null;
              })
              .filter((line): line is { lineId: number; quantity: number } => line !== null);

            if (packageLines.length > 0) {
              await this.trendyolApiService.updatePackage(
                order.store.sellerId,
                order.store.apiKey,
                order.store.apiSecret,
                order.shipmentPackageId,
                packageLines,
              );
              this.logger.log(`Updated Trendyol package status to Picking for order ${order.orderNumber}`);
            } else {
              this.logger.warn(`No valid line IDs found for order ${order.orderNumber}, skipping Trendyol update`);
            }
          } else {
            this.logger.warn(`No lines found for order ${order.orderNumber}, skipping Trendyol update`);
          }
        } catch (error) {
          this.logger.error(`Failed to update Trendyol package status for order ${order.orderNumber}: ${error.message}`, error.stack);
        }
      } else {
        this.logger.warn(`Store credentials missing for order ${order.orderNumber}, skipping Trendyol update`);
      }
      */
    }

    const updatedRoute = await this.routeRepository.findOne({
      where: { id: routeId },
      relations: ['orders', 'orders.store'],
    });

    return {
      zpl,
      route: RouteResponseDto.fromEntity(updatedRoute!, true),
    };
  }

  async remove(id: string): Promise<void> {
    const route = await this.routeRepository.findOne({
      where: { id },
      relations: ['orders'],
      withDeleted: false,
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.status === RouteStatus.COMPLETED) {
      throw new BadRequestException('Tamamlanmış rota silinemez');
    }

    for (const order of route.orders) {
      if (order.status === OrderStatus.COLLECTING) {
        await this.orderRepository.update(order.id, {
          status: OrderStatus.PENDING,
        });
      }
    }

    await this.routeRepository.update(id, { status: RouteStatus.CANCELLED });
  }

  async getRouteSuggestions(
    storeId?: string,
    paginationDto?: PaginationDto,
    typeFilter?: string[],
    productBarcodes?: string[],
  ): Promise<PaginationResponse<RouteSuggestion>> {
    const excludedStatuses = [
      OrderStatus.COLLECTING,
      OrderStatus.PACKED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ];

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.store', 'store')
      .where('order.status NOT IN (:...excludedStatuses)', { excludedStatuses });

    if (storeId) {
      queryBuilder.andWhere('order.storeId = :storeId', { storeId });
    }

    const orders = await queryBuilder.getMany();

    if (orders.length === 0) {
      return {
        success: true,
        data: [],
        meta: {
          page: paginationDto?.page || 1,
          limit: paginationDto?.limit || 10,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const suggestions: RouteSuggestion[] = [];

    const ordersByStore: Map<string, { storeName: string; orders: Order[] }> = new Map();

    for (const order of orders) {
      const storeKey = order.store?.id || 'no-store';
      const storeName = order.store?.name || 'Mağazasız';

      if (!ordersByStore.has(storeKey)) {
        ordersByStore.set(storeKey, { storeName, orders: [] });
      }
      ordersByStore.get(storeKey)!.orders.push(order);
    }

    for (const [storeKey, storeData] of ordersByStore) {
      const { storeName, orders: storeOrders } = storeData;

      const orderInfos: OrderWithProductInfo[] = [];

      for (const order of storeOrders) {
        const lines = order.lines as any[] | null;
        if (!lines || lines.length === 0) continue;

        const productInfos: ProductInfo[] = [];

        for (const line of lines) {
          const barcode = line.barcode || line.productBarcode;
          if (barcode) {
            productInfos.push({
              barcode,
              name: line.productName || line.name || 'Bilinmeyen Ürün',
              quantity: line.quantity || 1,
            });
          }
        }

        if (productInfos.length === 0) continue;

        const orderInfo: OrderWithProductInfo = {
          id: order.id,
          orderNumber: order.orderNumber,
          store: order.store ? { id: order.store.id, name: order.store.name } : null,
          customerFirstName: order.customerFirstName,
          customerLastName: order.customerLastName,
          products: productInfos,
          uniqueProductCount: new Set(productInfos.map(p => p.barcode)).size,
          totalQuantity: productInfos.reduce((sum, p) => sum + p.quantity, 0),
        };

        orderInfos.push(orderInfo);
      }

      const singleProductSingleQty: Map<string, OrderWithProductInfo[]> = new Map();
      const singleProductMultiQty: Map<string, Map<number, OrderWithProductInfo[]>> = new Map();
      const multiProductOrders: OrderWithProductInfo[] = [];

      for (const orderInfo of orderInfos) {
        const uniqueBarcodes = new Set(orderInfo.products.map(p => p.barcode));

        if (uniqueBarcodes.size === 1) {
          const barcode = Array.from(uniqueBarcodes)[0];
          const product = orderInfo.products.find(p => p.barcode === barcode)!;

          if (product.quantity === 1) {
            if (!singleProductSingleQty.has(barcode)) {
              singleProductSingleQty.set(barcode, []);
            }
            singleProductSingleQty.get(barcode)!.push(orderInfo);
          } else {
            if (!singleProductMultiQty.has(barcode)) {
              singleProductMultiQty.set(barcode, new Map());
            }
            const quantityMap = singleProductMultiQty.get(barcode)!;
            if (!quantityMap.has(product.quantity)) {
              quantityMap.set(product.quantity, []);
            }
            quantityMap.get(product.quantity)!.push(orderInfo);
          }
        } else {
          multiProductOrders.push(orderInfo);
        }
      }

      let priorityCounter = 10000;

      for (const [barcode, orderList] of singleProductSingleQty) {
        if (orderList.length === 0) continue;

        const product = orderList[0].products.find(p => p.barcode === barcode)!;
        const totalQty = orderList.reduce((sum, o) => sum + o.totalQuantity, 0);

        suggestions.push({
          id: `${storeKey}-single-${barcode}-qty-1`,
          type: 'single_product',
          name: `Tekli - ${product.name} (1 Adet)`,
          description: `${storeName} • ${orderList.length} sipariş • ${product.name}`,
          storeName,
          storeId: storeKey !== 'no-store' ? storeKey : undefined,
          orderCount: orderList.length,
          totalQuantity: totalQty,
          products: [{
            barcode,
            name: product.name,
            orderCount: orderList.length,
            totalQuantity: totalQty,
          }],
          orders: orderList,
          priority: priorityCounter--,
        });
      }

      for (const [barcode, quantityMap] of singleProductMultiQty) {
        const sortedQuantities = Array.from(quantityMap.keys()).sort((a, b) => a - b);

        for (const quantity of sortedQuantities) {
          const orderList = quantityMap.get(quantity)!;
          if (orderList.length === 0) continue;

          const product = orderList[0].products.find(p => p.barcode === barcode)!;
          const totalQty = orderList.reduce((sum, o) => sum + o.totalQuantity, 0);

          suggestions.push({
            id: `${storeKey}-single-${barcode}-qty-${quantity}`,
            type: 'single_product_multi',
            name: `Çoklu - ${product.name} (${quantity} Adet)`,
            description: `${storeName} • ${orderList.length} sipariş • ${product.name} - ${quantity} adet`,
            storeName,
            storeId: storeKey !== 'no-store' ? storeKey : undefined,
            orderCount: orderList.length,
            totalQuantity: totalQty,
            products: [{
              barcode,
              name: product.name,
              orderCount: orderList.length,
              totalQuantity: totalQty,
            }],
            orders: orderList,
            priority: priorityCounter--,
          });
        }
      }

      const multiProductGroups: Map<string, OrderWithProductInfo[]> = new Map();

      for (const orderInfo of multiProductOrders) {
        const productSignature = this.createProductSignature(orderInfo.products);
        if (!multiProductGroups.has(productSignature)) {
          multiProductGroups.set(productSignature, []);
        }
        multiProductGroups.get(productSignature)!.push(orderInfo);
      }

      for (const [signature, orderList] of multiProductGroups) {
        if (orderList.length === 0) continue;

        const productCounts: Map<string, { name: string; count: number; quantity: number }> = new Map();

        for (const order of orderList) {
          for (const product of order.products) {
            const existing = productCounts.get(product.barcode) || { name: product.name, count: 0, quantity: 0 };
            existing.count++;
            existing.quantity += product.quantity;
            productCounts.set(product.barcode, existing);
          }
        }

        const totalQty = orderList.reduce((sum, o) => sum + o.totalQuantity, 0);
        const productNames = Array.from(productCounts.values()).map(p => `${p.name}(${p.quantity})`).join(' + ');

        suggestions.push({
          id: `${storeKey}-multi-${signature}`,
          type: 'mixed',
          name: `Çoklu Ürün - ${productNames}`,
          description: `${storeName} • ${orderList.length} sipariş • ${Array.from(productCounts.values()).map(p => p.name).join(', ')}`,
          storeName,
          storeId: storeKey !== 'no-store' ? storeKey : undefined,
          orderCount: orderList.length,
          totalQuantity: totalQty,
          products: Array.from(productCounts.entries()).map(([bc, info]) => ({
            barcode: bc,
            name: info.name,
            orderCount: info.count,
            totalQuantity: info.quantity,
          })),
          orders: orderList,
          priority: priorityCounter--,
        });
      }
    }

    let filteredSuggestions = suggestions;

    if (typeFilter && typeFilter.length > 0) {
      filteredSuggestions = filteredSuggestions.filter((s) => typeFilter.includes(s.type));
    }

    if (productBarcodes && productBarcodes.length > 0) {
      filteredSuggestions = filteredSuggestions.filter((s) =>
        s.products.some((p) => productBarcodes.includes(p.barcode)),
      );
    }

    const sortBy = paginationDto?.sortBy || 'priority';
    const sortOrder = paginationDto?.sortOrder || 'DESC';

    filteredSuggestions.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'orderCount':
          aValue = a.orderCount;
          bValue = b.orderCount;
          break;
        case 'totalQuantity':
          aValue = a.totalQuantity;
          bValue = b.totalQuantity;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'priority':
        default:
          aValue = a.priority;
          bValue = b.priority;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'ASC'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === 'ASC' ? aValue - bValue : bValue - aValue;
    });

    const page = paginationDto?.page || 1;
    const limit = paginationDto?.limit || 10;
    const total = filteredSuggestions.length;
    const skip = (page - 1) * limit;
    const paginatedSuggestions = filteredSuggestions.slice(skip, skip + limit);

    return {
      success: true,
      data: paginatedSuggestions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private createProductSignature(products: ProductInfo[]): string {
    const sorted = [...products].sort((a, b) => a.barcode.localeCompare(b.barcode));
    return sorted.map(p => `${p.barcode}:${p.quantity}`).join('|');
  }
}

interface ProductInfo {
  barcode: string;
  name: string;
  quantity: number;
}

interface OrderWithProductInfo {
  id: string;
  orderNumber: string;
  store: { id: string; name: string } | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  products: ProductInfo[];
  uniqueProductCount: number;
  totalQuantity: number;
}

interface RouteSuggestionProduct {
  barcode: string;
  name: string;
  orderCount: number;
  totalQuantity: number;
}

export interface RouteSuggestion {
  id: string;
  type: 'single_product' | 'single_product_multi' | 'mixed';
  name: string;
  description: string;
  storeName?: string;
  storeId?: string;
  orderCount: number;
  totalQuantity: number;
  products: RouteSuggestionProduct[];
  orders: OrderWithProductInfo[];
  priority: number;
}

