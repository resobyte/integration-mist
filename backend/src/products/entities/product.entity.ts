import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Store } from '../../stores/entities/store.entity';

@Entity('products')
export class Product extends BaseEntity {
  @ManyToOne(() => Store, { nullable: false })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 36 })
  storeId: string;

  @Column({ length: 255 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  stock: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  purchasePrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  trendyolProductId: string | null;

  @Column({ type: 'bigint', nullable: true })
  trendyolProductCode: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  categoryName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  size: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  listPrice: number | null;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  productUrl: string | null;

  @Column({ type: 'bigint', nullable: true })
  trendyolLastUpdateDate: number | null;
}

