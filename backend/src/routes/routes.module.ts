import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { Route } from './entities/route.entity';
import { RouteOrder } from './entities/route-order.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { ZplLabelService } from './zpl-label.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Route, RouteOrder, Order]),
    OrdersModule,
  ],
  controllers: [RoutesController],
  providers: [RoutesService, ZplLabelService],
  exports: [RoutesService],
})
export class RoutesModule {}





