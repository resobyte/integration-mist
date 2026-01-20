import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersCronService } from './orders-cron.service';
import { TrendyolApiService } from './trendyol-api.service';
import { SyncLockService } from './sync-lock.service';
import { Order } from './entities/order.entity';
import { StoresModule } from '../stores/stores.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    StoresModule,
    ProductsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCronService, TrendyolApiService, SyncLockService],
  exports: [OrdersService, TrendyolApiService],
})
export class OrdersModule {}

