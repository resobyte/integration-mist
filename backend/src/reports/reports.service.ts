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
    
    // orderDate GMT+3 formatında timestamp olarak doğrudan saklanır
    // Yani orderDate = 1768176155973 değeri "12 Ocak 2026 00:02:35 GMT+3" anlamına gelir
    // Bu değer UTC'ye çevrilmemiş, doğrudan GMT+3 saatinin timestamp'i
    // Bu yüzden karşılaştırma için de aynı formatta timestamp oluşturmalıyız
    if (startDate) {
      const [year, month, day] = startDate.split('-').map(Number);
      // Tarihi doğrudan UTC timestamp olarak oluştur (timezone offset yok)
      // "2026-01-12 00:00:00" -> 1768176000000 (GMT+3 formatıyla eşleşir)
      startTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    } else {
      // Bugünün başlangıcını GMT+3'e göre hesapla
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStr = formatter.format(now);
      const [year, month, day] = dateStr.split('-').map(Number);
      startTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    }
    
    if (endDate) {
      const [year, month, day] = endDate.split('-').map(Number);
      // Tarihi doğrudan UTC timestamp olarak oluştur (günün sonu)
      endTimestamp = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    } else {
      // Bugünün sonunu GMT+3'e göre hesapla
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStr = formatter.format(now);
      const [year, month, day] = dateStr.split('-').map(Number);
      endTimestamp = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    }

    this.logger.debug(`Date filter: startDate=${startDate}, endDate=${endDate}, startTimestamp=${startTimestamp}, endTimestamp=${endTimestamp}`);

    // orderDate bigint (GMT+3 formatında timestamp) olarak saklanır
    // startTimestamp ve endTimestamp de GMT+3 formatında hesaplandığı için direkt karşılaştırma yapılabilir
    // Trendyol panelinde CANCELLED ve RETURNED siparişler ciroya dahil edilmez
    // Hem bizim status hem de trendyolStatus kontrol edilmeli
    const orderQueryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.store', 'store')
      .where('order.isActive = :isActive', { isActive: true })
      .andWhere('store.isActive = :storeIsActive', { storeIsActive: true })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { 
        excludedStatuses: [OrderStatus.CANCELLED, OrderStatus.RETURNED] 
      })
      .andWhere('order.trendyolStatus NOT IN (:...excludedTrendyolStatuses)', {
        excludedTrendyolStatuses: ['Cancelled', 'Returned', 'UnSupplied']
      })
      .andWhere('order.orderDate >= :startDate', { startDate: startTimestamp })
      .andWhere('order.orderDate <= :endDate', { endDate: endTimestamp });

    if (storeIds && storeIds.length > 0) {
      orderQueryBuilder.andWhere('order.storeId IN (:...storeIds)', { storeIds });
    }

    // createdAt UTC formatında timestamp olarak saklanır
    // Kullanıcı tarihi GMT+3'te seçiyor, bu yüzden GMT+3'ten UTC'ye çevirmeliyiz
    // Örnek: "2026-01-12" GMT+3 = "2026-01-12T00:00:00+03:00" = UTC'de "2026-01-11T21:00:00Z"
    let routeStartTimestamp: Date;
    let routeEndTimestamp: Date;
    
    if (startDate) {
      const [year, month, day] = startDate.split('-').map(Number);
      const gmt3DateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+03:00`;
      routeStartTimestamp = new Date(gmt3DateStr);
    } else {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStr = formatter.format(now);
      const gmt3DateStr = `${dateStr}T00:00:00+03:00`;
      routeStartTimestamp = new Date(gmt3DateStr);
    }
    
    if (endDate) {
      const [year, month, day] = endDate.split('-').map(Number);
      const gmt3DateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999+03:00`;
      routeEndTimestamp = new Date(gmt3DateStr);
    } else {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStr = formatter.format(now);
      const gmt3DateStr = `${dateStr}T23:59:59.999+03:00`;
      routeEndTimestamp = new Date(gmt3DateStr);
    }

    const routeQueryBuilder = this.routeRepository
      .createQueryBuilder('route')
      .leftJoin('route.orders', 'order')
      .leftJoin('order.store', 'store')
      .where('route.isActive = :isActive', { isActive: true })
      .andWhere('store.isActive = :storeIsActive', { storeIsActive: true })
      .andWhere('route.status = :completedStatus', { completedStatus: RouteStatus.COMPLETED })
      .andWhere('route.createdAt >= :routeStartDate', { routeStartDate: routeStartTimestamp })
      .andWhere('route.createdAt <= :routeEndDate', { routeEndDate: routeEndTimestamp });

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
          // Trendyol line yapısı:
          // - amount: Net tutar (indirim sonrası, Trendyol'un Net Ciro'su bu)
          // - price: Liste fiyatı (indirim öncesi)
          // - discount: İndirim tutarı
          const lineAmount = line.amount || 0;
          const linePrice = line.price || 0;
          // Önce amount'u kullan (net tutar), yoksa price * quantity, yoksa order'dan hesapla
          const lineRevenue = lineAmount > 0 
            ? lineAmount 
            : (linePrice > 0 ? linePrice * quantity : (orderTotalQuantity > 0 ? (orderTotalPrice / orderTotalQuantity) * quantity : 0));

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

