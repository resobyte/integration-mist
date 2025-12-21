import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductsService } from './products.service';

@Injectable()
export class ProductsCronService {
  private readonly logger = new Logger(ProductsCronService.name);

  constructor(private readonly productsService: ProductsService) {}

  @Cron('*/1 * * * *', {
    name: 'syncProductsFromTrendyol',
    timeZone: 'Europe/Istanbul',
  })
  async handleCron() {
    try {
      await this.productsService.syncAllStoresProducts();
    } catch (error) {
      this.logger.error(`Nightly product sync failed: ${error.message}`, error.stack);
    }
  }
}

