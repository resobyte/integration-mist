import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('stores')
export class Store extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  sellerId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiSecret: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  token: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;
}

