import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from './orders.service';
import { StoresService } from '../stores/stores.service';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly storesService: StoresService,
  ) {}

  @Cron('*/1 * * * *')
  async handleOrdersFetch() {
    try {
      const storesResponse = await this.storesService.findAll(
        { page: 1, limit: 1000, sortBy: 'createdAt', sortOrder: 'ASC' },
      );

      const stores = storesResponse.data.filter(
        (store) => store.sellerId && store.apiKey && store.apiSecret && store.isActive,
      );

      for (const store of stores) {
        try {
          await this.ordersService.fetchAndSaveOrders(store.id);
        } catch (error) {
          this.logger.error(
            `Error fetching orders for store ${store.name} (${store.id}): ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error in scheduled order fetch job: ${error.message}`, error.stack);
    }
  }
}

