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

  @Cron('0 * * * *')
  async handleNonDeliveredOrdersSync() {
    try {
      this.logger.log('Starting non-delivered orders sync job...');
      const result = await this.ordersService.syncAllNonDeliveredOrders();
      
      const totalUpdated = result.results.reduce((sum, r) => sum + r.updated, 0);
      const totalSkipped = result.results.reduce((sum, r) => sum + r.skipped, 0);
      const totalNotFound = result.results.reduce((sum, r) => sum + r.notFound, 0);
      const totalErrors = result.results.reduce((sum, r) => sum + r.errors, 0);
      
      this.logger.log(
        `Non-delivered orders sync completed: ${result.totalStores} stores processed, ` +
        `${totalUpdated} updated, ${totalSkipped} skipped, ${totalNotFound} not found, ${totalErrors} errors`
      );
    } catch (error) {
      this.logger.error(`Error in non-delivered orders sync job: ${error.message}`, error.stack);
    }
  }
}

