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
        id: randomUUID(),
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

    for (const order of route.orders) {
      if (order.status === OrderStatus.COLLECTING) {
        await this.orderRepository.update(order.id, {
          status: OrderStatus.PENDING,
        });
      }
    }

    await this.routeRepository.softDelete(id);
  }
}

