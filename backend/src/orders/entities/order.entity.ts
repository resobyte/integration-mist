import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Store } from '../../stores/entities/store.entity';

export enum TrendyolOrderStatus {
  AWAITING = 'Awaiting',
  CREATED = 'Created',
  PICKING = 'Picking',
  INVOICED = 'Invoiced',
  SHIPPED = 'Shipped',
  AT_COLLECTION_POINT = 'AtCollectionPoint',
  CANCELLED = 'Cancelled',
  UNPACKED = 'UnPacked',
  DELIVERED = 'Delivered',
  UNDELIVERED = 'UnDelivered',
  RETURNED = 'Returned',
  UNSUPPLIED = 'UnSupplied',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COLLECTING = 'COLLECTING',
  PACKED = 'PACKED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => Store, { nullable: false })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 36 })
  storeId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  orderNumber: string;

  @Column({ type: 'bigint', unique: true })
  shipmentPackageId: number;

  @Column({ type: 'bigint', nullable: true })
  trendyolCustomerId: number | null;

  @Column({ type: 'bigint', nullable: true })
  supplierId: number | null;

  @Column({ type: 'varchar', length: 50 })
  trendyolStatus: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerFirstName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerLastName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null;

  @Column({ type: 'bigint' })
  orderDate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'varchar', length: 10, default: 'TRY' })
  currencyCode: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cargoTrackingNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cargoProviderName: string | null;

  @Column({ type: 'text', nullable: true })
  cargoTrackingLink: string | null;

  @Column({ type: 'json', nullable: true })
  shipmentAddress: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  invoiceAddress: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  lines: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  packageHistories: Record<string, unknown>[] | null;

  @Column({ type: 'boolean', default: false })
  commercial: boolean;

  @Column({ type: 'boolean', default: false })
  micro: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deliveryAddressType: string | null;

  @Column({ type: 'bigint', nullable: true })
  lastModifiedDate: number | null;

  @Column({ type: 'bigint', nullable: true })
  agreedDeliveryDate: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}

