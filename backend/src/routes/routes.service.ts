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
import { ZplLabelService } from './zpl-label.service';

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

  async findAll(): Promise<RouteResponseDto[]> {
    const routes = await this.routeRepository.find({
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

  // TODO: Sipariş durumuna göre filtreleme eklenecek (COLLECTING, PACKED, SHIPPED, DELIVERED, CANCELLED hariç tutulacak)
  async getRouteSuggestions(storeId?: string): Promise<RouteSuggestion[]> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.store', 'store');

    if (storeId) {
      queryBuilder.andWhere('order.storeId = :storeId', { storeId });
    }

    const orders = await queryBuilder.getMany();

    if (orders.length === 0) {
      return [];
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

      const singleProductByQuantity: Map<number, OrderWithProductInfo[]> = new Map();
      const mixedByQuantity: Map<number, OrderWithProductInfo[]> = new Map();

      for (const order of storeOrders) {
        const lines = order.lines as any[] | null;
        if (!lines || lines.length === 0) continue;

        const uniqueBarcodes = new Set<string>();
        const productInfos: ProductInfo[] = [];

        for (const line of lines) {
          const barcode = line.barcode || line.productBarcode;
          if (barcode) {
            uniqueBarcodes.add(barcode);
            productInfos.push({
              barcode,
              name: line.productName || line.name || 'Bilinmeyen Ürün',
              quantity: line.quantity || 1,
            });
          }
        }

        const totalQuantity = productInfos.reduce((sum, p) => sum + p.quantity, 0);

        const orderInfo: OrderWithProductInfo = {
          id: order.id,
          orderNumber: order.orderNumber,
          store: order.store ? { id: order.store.id, name: order.store.name } : null,
          customerFirstName: order.customerFirstName,
          customerLastName: order.customerLastName,
          products: productInfos,
          uniqueProductCount: uniqueBarcodes.size,
          totalQuantity,
        };

        if (uniqueBarcodes.size === 1) {
          if (!singleProductByQuantity.has(totalQuantity)) {
            singleProductByQuantity.set(totalQuantity, []);
          }
          singleProductByQuantity.get(totalQuantity)!.push(orderInfo);
        } else if (uniqueBarcodes.size > 1) {
          if (!mixedByQuantity.has(totalQuantity)) {
            mixedByQuantity.set(totalQuantity, []);
          }
          mixedByQuantity.get(totalQuantity)!.push(orderInfo);
        }
      }

      const sortedQuantities = Array.from(singleProductByQuantity.keys()).sort((a, b) => a - b);

      for (const quantity of sortedQuantities) {
        const orderList = singleProductByQuantity.get(quantity)!;
        if (orderList.length > 0) {
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
          const productNames = Array.from(productCounts.values()).map(p => p.name);

          suggestions.push({
            id: `${storeKey}-single-qty-${quantity}`,
            type: 'single_product',
            name: `Tek Ürün - ${quantity} Adet`,
            description: `${storeName} • ${orderList.length} sipariş • ${productNames.slice(0, 2).join(', ')}${productNames.length > 2 ? ` +${productNames.length - 2}` : ''}`,
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
            priority: orderList.length * 10 + (10 - quantity),
          });
        }
      }

      const sortedMixedQuantities = Array.from(mixedByQuantity.keys()).sort((a, b) => a - b);

      for (const quantity of sortedMixedQuantities) {
        const orderList = mixedByQuantity.get(quantity)!;
        if (orderList.length > 0) {
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

          suggestions.push({
            id: `${storeKey}-mixed-qty-${quantity}`,
            type: 'mixed',
            name: `Karışık - ${quantity} Adet`,
            description: `${storeName} • ${orderList.length} sipariş, birden fazla ürün türü`,
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
            priority: orderList.length * 5,
          });
        }
      }

      const allSingleOrders = Array.from(singleProductByQuantity.values()).flat();
      if (allSingleOrders.length > 1) {
        const productCounts: Map<string, { name: string; count: number; quantity: number }> = new Map();

        for (const order of allSingleOrders) {
          for (const product of order.products) {
            const existing = productCounts.get(product.barcode) || { name: product.name, count: 0, quantity: 0 };
            existing.count++;
            existing.quantity += product.quantity;
            productCounts.set(product.barcode, existing);
          }
        }

        const totalQuantity = allSingleOrders.reduce((sum, o) => sum + o.totalQuantity, 0);

        suggestions.push({
          id: `${storeKey}-all-singles`,
          type: 'all_singles',
          name: `Tüm Tek Ürünlüler`,
          description: `${storeName} • ${allSingleOrders.length} sipariş, farklı adetler`,
          storeName,
          storeId: storeKey !== 'no-store' ? storeKey : undefined,
          orderCount: allSingleOrders.length,
          totalQuantity,
          products: Array.from(productCounts.entries()).map(([bc, info]) => ({
            barcode: bc,
            name: info.name,
            orderCount: info.count,
            totalQuantity: info.quantity,
          })),
          orders: allSingleOrders,
          priority: 100,
        });
      }
    }

    suggestions.sort((a, b) => b.priority - a.priority);

    return suggestions;
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
  type: 'single_product' | 'mixed' | 'all_singles';
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

