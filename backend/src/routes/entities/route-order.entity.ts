import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Route } from './route.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('route_orders')
export class RouteOrder {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  routeId: string;

  @PrimaryColumn({ type: 'varchar', length: 36 })
  orderId: string;

  @ManyToOne(() => Route, (route) => route.routeOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}

