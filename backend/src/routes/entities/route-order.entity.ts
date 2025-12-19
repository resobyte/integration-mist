import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn, BeforeInsert } from 'typeorm';
import { Route } from './route.entity';
import { Order } from '../../orders/entities/order.entity';
import { randomUUID } from 'crypto';

@Entity('route_orders')
export class RouteOrder {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @ManyToOne(() => Route, (route) => route.routeOrders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeId' })
  route: Route;

  @Column({ type: 'varchar', length: 36 })
  routeId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  addedAt: Date;
}

