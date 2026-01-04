import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Route } from '../routes/entities/route.entity';
import { RouteStatus } from '../routes/entities/route.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { ProductSalesReportDto } from './dto/product-sales-report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getReports(filter: ReportFilterDto): Promise<ReportResponseDto> {
    const { storeIds, startDate, endDate } = filter;

    let startTimestamp: number;
    let endTimestamp: number;
    
    // orderDate GMT+3 (Türkiye saati) formatında timestamp olarak gelir
    // Seçilen tarihi GMT+3'e göre timestamp'e çeviriyoruz
    if (startDate) {
      // YYYY-MM-DD formatındaki tarihi parse edip GMT+3'e göre timestamp oluştur
      const [year, month, day] = startDate.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      // GMT+3 offset'i ekle (3 saat = 3 * 60 * 60 * 1000 ms)
      startTimestamp = start.getTime() + (3 * 60 * 60 * 1000);
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      startTimestamp = start.getTime() + (3 * 60 * 60 * 1000);
    }
    
    if (endDate) {
      const [year, month, day] = endDate.split('-').map(Number);
      const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      // GMT+3 offset'i ekle
      endTimestamp = end.getTime() + (3 * 60 * 60 * 1000);
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      endTimestamp = end.getTime() + (3 * 60 * 60 * 1000);
    }

    this.logger.debug(`Date filter: startDate=${startDate}, endDate=${endDate}, startTimestamp=${startTimestamp}, endTimestamp=${endTimestamp}`);

    const orderQueryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.store', 'store')
      .where('order.isActive = :isActive', { isActive: true })
      .andWhere('store.isActive = :storeIsActive', { storeIsActive: true })
      .andWhere('order.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .andWhere('order.orderDate >= :startDate', { startDate: startTimestamp })
      .andWhere('order.orderDate <= :endDate', { endDate: endTimestamp });

    if (storeIds && storeIds.length > 0) {
      orderQueryBuilder.andWhere('order.storeId IN (:...storeIds)', { storeIds });
    }

    const routeStart = startDate ? new Date(startDate) : new Date();
    routeStart.setHours(0, 0, 0, 0);
    
    const routeEnd = endDate ? new Date(endDate) : new Date();
    routeEnd.setHours(23, 59, 59, 999);

    const routeQueryBuilder = this.routeRepository
      .createQueryBuilder('route')
      .leftJoin('route.orders', 'order')
      .leftJoin('order.store', 'store')
      .where('route.isActive = :isActive', { isActive: true })
      .andWhere('store.isActive = :storeIsActive', { storeIsActive: true })
      .andWhere('route.status = :completedStatus', { completedStatus: RouteStatus.COMPLETED })
      .andWhere('route.createdAt >= :routeStartDate', { routeStartDate: routeStart })
      .andWhere('route.createdAt <= :routeEndDate', { routeEndDate: routeEnd });

    if (storeIds && storeIds.length > 0) {
      routeQueryBuilder.andWhere('order.storeId IN (:...storeIds)', { storeIds });
    }

    const [ordersWithLines, totalCompletedRoutesResult] = await Promise.all([
      orderQueryBuilder
        .clone()
        .select(['order.id', 'order.lines', 'order.totalPrice'])
        .getMany(),
      routeQueryBuilder.clone().getCount(),
    ]);

    const filteredOrders = ordersWithLines;

    let totalSalesQuantity = 0;
    
    for (const order of filteredOrders) {
      if (order.lines && Array.isArray(order.lines)) {
        for (const line of order.lines as any[]) {
          const quantity = line.quantity || 0;
          totalSalesQuantity += quantity;
        }
      }
    }

    const totalRevenue = filteredOrders.reduce((sum, order) => {
      const price = typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : (order.totalPrice || 0);
      return sum + price;
    }, 0);

    const productSalesMap = new Map<string, { barcode: string; quantity: number; revenue: number }>();

    for (const order of filteredOrders) {
      if (order.lines && Array.isArray(order.lines)) {
        const orderTotalPrice = typeof order.totalPrice === 'string' ? parseFloat(order.totalPrice) : (order.totalPrice || 0);
        const orderTotalQuantity = (order.lines as any[]).reduce((sum, line) => sum + (line.quantity || 0), 0);
        
        for (const line of order.lines as any[]) {
          const barcode = line.barcode || line.productBarcode;
          if (!barcode) continue;

          const quantity = line.quantity || 0;
          const linePrice = line.price || 0;
          const lineRevenue = linePrice > 0 ? linePrice * quantity : (orderTotalQuantity > 0 ? (orderTotalPrice / orderTotalQuantity) * quantity : 0);

          const existing = productSalesMap.get(barcode);
          if (existing) {
            existing.quantity += quantity;
            existing.revenue += lineRevenue;
          } else {
            productSalesMap.set(barcode, {
              barcode,
              quantity,
              revenue: lineRevenue,
            });
          }
        }
      }
    }

    const salesProductBarcodes = Array.from(productSalesMap.keys());
    const products = salesProductBarcodes.length > 0
      ? await this.productRepository.find({
          where: salesProductBarcodes.map(barcode => ({ barcode, isActive: true })),
        })
      : [];

    const productMap = new Map(products.map(p => [p.barcode, p]));

    const productSales: ProductSalesReportDto[] = Array.from(productSalesMap.values())
      .map(({ barcode, quantity, revenue }) => {
        const product = productMap.get(barcode);
        return {
          barcode,
          productName: product?.name || 'Bilinmeyen Ürün',
          imageUrl: product?.imageUrl || null,
          quantity,
          revenue,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);

    return {
      totalRevenue,
      totalOrders: filteredOrders.length,
      totalSalesQuantity,
      totalCompletedRoutes: totalCompletedRoutesResult,
      productSales,
    };
  }
}

