import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductsService } from './products.service';

@Injectable()
export class ProductsCronService {
  private readonly logger = new Logger(ProductsCronService.name);

  constructor(private readonly productsService: ProductsService) {}

  @Cron('0 0 * * *', {
    name: 'syncProductsFromTrendyol',
    timeZone: 'Europe/Istanbul',
  })
  async handleCron() {
    this.logger.log('Starting nightly product sync from Trendyol...');

    try {
      const result = await this.productsService.syncAllStoresProducts();

      const totalCreated = result.results.reduce((sum, r) => sum + r.created, 0);
      const totalUpdated = result.results.reduce((sum, r) => sum + r.updated, 0);
      const totalErrors = result.results.reduce((sum, r) => sum + r.errors, 0);

      this.logger.log(
        `Nightly product sync completed. Stores: ${result.totalStores}, Created: ${totalCreated}, Updated: ${totalUpdated}, Errors: ${totalErrors}`,
      );
    } catch (error) {
      this.logger.error(`Nightly product sync failed: ${error.message}`, error.stack);
    }
  }
}

