import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

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
  ) {}

  async getStats(): Promise<DashboardStats> {
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
        waitingClaims += claims.filter((claim) => {
          if (!claim.items || !Array.isArray(claim.items) || claim.items.length === 0) {
            return false;
          }
          const firstItem = claim.items[0] as { claimItems?: { claimItemStatus?: { name?: string } }[] };
          const statusName = firstItem?.claimItems?.[0]?.claimItemStatus?.name;
          return statusName === 'WaitingInAction';
        }).length;
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

    return {
      totalStores,
      totalProducts,
      pendingOrders,
      packedOrders,
      waitingRoutes,
      completedRoutes,
      waitingClaims,
      waitingQuestions,
    };
  }
}

