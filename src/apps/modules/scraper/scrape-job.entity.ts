import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TramaProviderSeed } from '../../../libs/providers';

export enum ScrapeJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('scrape_jobs')
export class ScrapeJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  investigationId: string | null;

  @Column()
  source: string;

  @Column({ type: 'enum', enum: ScrapeJobStatus, default: ScrapeJobStatus.PENDING })
  status: ScrapeJobStatus;

  @Column({ type: 'jsonb' })
  seed: TramaProviderSeed;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string | null;

  @Column({ nullable: true, type: 'varchar' })
  bullJobId: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  startedAt: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  finishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
