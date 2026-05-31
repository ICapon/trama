import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TramaProviderSeed } from '../../../libs/providers';

export enum CronJobStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
}

@Entity('cron_jobs')
export class CronJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar' })
  cronExpression: string;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'varchar' })
  entityId: string;

  @Column({ type: 'uuid' })
  investigationId: string;

  @Column({ type: 'jsonb', nullable: true })
  seed: TramaProviderSeed | null;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: CronJobStatus, default: CronJobStatus.ACTIVE })
  status: CronJobStatus;

  @Column({ type: 'varchar', nullable: true })
  schedulerKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
