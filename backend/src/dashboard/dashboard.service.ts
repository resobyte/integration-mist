import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Route, RouteStatus } from '../routes/entities/route.entity';
import { TrendyolClaimsApiService } from '../claims/trendyol-claims-api.service';
import { TrendyolQuestionsApiService } from '../questions/trendyol-questions-api.service';

export interface DashboardStats {
  totalStores: number;
  totalProducts: number;
  pendingOrders: number;
  packedOrders: number;
  waitingRoutes: number;
  completedRoutes: number;
  waitingClaims: number;
  waitingQuestions: number;
}

@Injectable()
export class DashboardService implements OnModuleInit {
  private readonly logger = new Logger(DashboardService.name);
  private readonly EXTERNAL_STATS_CACHE_KEY = 'dashboard_external_stats';

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    private readonly trendyolClaimsApiService: TrendyolClaimsApiService,
    private readonly trendyolQuestionsApiService: TrendyolQuestionsApiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    // Initial refresh on startup
    this.refreshExternalStats();
  }

  async getStats(): Promise<DashboardStats> {
    const internalStats = await this.getInternalStats();
    const externalStats = await this.getExternalStats();

    return {
      ...internalStats,
      ...externalStats,
    };
  }

  async getInternalStats() {
    const [
      totalStores,
      totalProducts,
      pendingOrders,
      packedOrders,
      waitingRoutes,
      completedRoutes,
    ] = await Promise.all([
      this.storeRepository.count({ where: { isActive: true } }),
      this.productRepository.count({ where: { isActive: true } }),
      this.orderRepository.count({ where: { status: OrderStatus.PENDING } }),
      this.orderRepository.count({ where: { status: OrderStatus.PACKED } }),
      this.routeRepository.count({
        where: { status: In([RouteStatus.COLLECTING, RouteStatus.READY]) },
      }),
      this.routeRepository.count({ where: { status: RouteStatus.COMPLETED } }),
    ]);

    return {
      totalStores,
      totalProducts,
      pendingOrders,
      packedOrders,
      waitingRoutes,
      completedRoutes,
    };
  }

  async getExternalStats(): Promise<{ waitingClaims: number; waitingQuestions: number }> {
    const cached = await this.cacheManager.get<{ waitingClaims: number; waitingQuestions: number }>(
      this.EXTERNAL_STATS_CACHE_KEY,
    );

    if (cached) {
      return cached;
    }

    // If not in cache, trigger background update and return current zeros or a fallback
    // For the first time, we might have to wait or just return 0 and let cron fill it
    this.refreshExternalStats(); 
    
    return {
      waitingClaims: 0,
      waitingQuestions: 0,
    };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshExternalStats() {
    this.logger.log('Refreshing dashboard external stats...');
    
    try {
      const stores = await this.storeRepository.find({
        where: { isActive: true },
      });

      const activeStores = stores.filter(
        (store) => store.sellerId && store.apiKey && store.apiSecret,
      );

      let waitingClaims = 0;
      let waitingQuestions = 0;

      for (const store of activeStores) {
        try {
          const claims = await this.trendyolClaimsApiService.getAllClaims(
            store.sellerId!,
            store.apiKey!,
            store.apiSecret!,
          );
          // Count all claims returned by default (Created) + any other pending statuses if we want
          // Since getAllClaims defaults to 'Created', we count those.
          waitingClaims += claims.length;
        } catch (error) {
          this.logger.error(`Error fetching claims for store ${store.name}:`, error);
        }

        try {
          const questions = await this.trendyolQuestionsApiService.getAllQuestions(
            store.sellerId!,
            store.apiKey!,
            store.apiSecret!,
            'WAITING_FOR_ANSWER',
          );
          waitingQuestions += questions.length;
        } catch (error) {
          this.logger.error(`Error fetching questions for store ${store.name}:`, error);
        }
      }

      const stats = { waitingClaims, waitingQuestions };
      await this.cacheManager.set(this.EXTERNAL_STATS_CACHE_KEY, stats, 1200000); // 20 min cache
      this.logger.log('Dashboard external stats refreshed.');
      return stats;
    } catch (error) {
      this.logger.error('Failed to refresh dashboard external stats:', error);
    }
  }
}

