import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Store } from '../../stores/entities/store.entity';

export enum ClaimStatus {
  CREATED = 'Created',
  WAITING_IN_ACTION = 'WaitingInAction',
  WAITING_FRAUD_CHECK = 'WaitingFraudCheck',
  ACCEPTED = 'Accepted',
  CANCELLED = 'Cancelled',
  REJECTED = 'Rejected',
  UNRESOLVED = 'Unresolved',
  IN_ANALYSIS = 'InAnalysis',
}

@Entity('claims')
export class Claim extends BaseEntity {
  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'varchar', length: 36 })
  storeId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  claimId: string;

  @Column({ type: 'varchar', length: 100 })
  orderNumber: string;

  @Column({ type: 'bigint', nullable: true })
  orderDate: number | null;

  @Column({ type: 'bigint', nullable: true })
  claimDate: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerFirstName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerLastName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cargoTrackingNumber: string | null;

  @Column({ type: 'text', nullable: true })
  cargoTrackingLink: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cargoSenderNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cargoProviderName: string | null;

  @Column({ type: 'bigint', nullable: true })
  orderShipmentPackageId: number | null;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.CREATED })
  status: ClaimStatus;

  @Column({ type: 'json', nullable: true })
  items: Record<string, unknown>[] | null;

  @Column({ type: 'json', nullable: true })
  rejectedPackageInfo: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  replacementOutboundPackageInfo: Record<string, unknown> | null;

  @Column({ type: 'bigint', nullable: true })
  lastModifiedDate: number | null;

  @Column({ type: 'bigint', nullable: true })
  orderOutboundPackageId: number | null;

  @Column({ type: 'boolean', default: false })
  isApproved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;
}

