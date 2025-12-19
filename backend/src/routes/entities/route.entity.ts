import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { RouteOrder } from './route-order.entity';

export enum RouteStatus {
  COLLECTING = 'COLLECTING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
}

@Entity('routes')
export class Route extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: RouteStatus, default: RouteStatus.COLLECTING })
  status: RouteStatus;

  @ManyToMany(() => Order)
  @JoinTable({
    name: 'route_orders',
    joinColumn: { name: 'routeId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'orderId', referencedColumnName: 'id' },
  })
  orders: Order[];

  @OneToMany(() => RouteOrder, (routeOrder) => routeOrder.route)
  routeOrders: RouteOrder[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  labelPrintedAt: string | null;
}




