import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsCronService } from './products-cron.service';
import { TrendyolProductApiService } from './trendyol-product-api.service';
import { Product } from './entities/product.entity';
import { Store } from '../stores/entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Store]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsCronService, TrendyolProductApiService],
  exports: [ProductsService],
})
export class ProductsModule {}

