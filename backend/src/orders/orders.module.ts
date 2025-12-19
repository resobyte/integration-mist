import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersCronService } from './orders-cron.service';
import { TrendyolApiService } from './trendyol-api.service';
import { Order } from './entities/order.entity';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ScheduleModule.forRoot(),
    StoresModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCronService, TrendyolApiService],
  exports: [OrdersService],
})
export class OrdersModule {}

