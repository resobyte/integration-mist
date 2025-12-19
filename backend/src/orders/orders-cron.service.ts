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

  @Cron('*/10 * * * *')
  async handleOrdersFetch() {
    this.logger.log('Starting scheduled order fetch job...');

    try {
      const storesResponse = await this.storesService.findAll(
        { page: 1, limit: 1000, sortBy: 'createdAt', sortOrder: 'ASC' },
      );

      const stores = storesResponse.data.filter(
        (store) => store.sellerId && store.apiKey && store.apiSecret && store.isActive,
      );

      this.logger.log(`Found ${stores.length} active stores with sellerId, apiKey and apiSecret`);

      for (const store of stores) {
        try {
          this.logger.log(`Fetching orders for store: ${store.name} (${store.id})`);
          
          const result = await this.ordersService.fetchAndSaveOrders(store.id);
          
          this.logger.log(
            `Store ${store.name}: Saved: ${result.saved}, Updated: ${result.updated}, Errors: ${result.errors}`,
          );
        } catch (error) {
          this.logger.error(
            `Error fetching orders for store ${store.name} (${store.id}): ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log('Scheduled order fetch job completed');
    } catch (error) {
      this.logger.error(`Error in scheduled order fetch job: ${error.message}`, error.stack);
    }
  }
}

