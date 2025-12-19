import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../stores/entities/store.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { Route } from '../routes/entities/route.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ClaimsModule } from '../claims/claims.module';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Product, Order, Route]),
    ClaimsModule,
    QuestionsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

