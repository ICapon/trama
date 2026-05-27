import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ScrapeResultStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  NO_DATA = 'no_data',
  ERROR = 'error',
}

@Entity('scrape_results')
export class ScrapeResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  scrapeJobId: string;

  @Column({ type: 'uuid' })
  investigationId: string;

  @Column({ type: 'varchar' })
  entityId: string;

  @Column()
  source: string;

  @Column({ nullable: true, type: 'varchar' })
  sourceUrl: string | null;

  @Column({ type: 'enum', enum: ScrapeResultStatus })
  status: ScrapeResultStatus;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ type: 'jsonb', nullable: true })
  rawData: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  summary: unknown | null;

  @Column({ type: 'int', default: 0 })
  nodesCreated: number;

  @Column({ type: 'int', default: 0 })
  relationshipsCreated: number;

  @Column('text', { array: true, default: '{}' })
  neo4jNodeIds: string[];

  @Column({ nullable: true, type: 'varchar' })
  neo4jScrapeResultId: string | null;

  @Column({ type: 'timestamptz' })
  executedAt: Date;

  @Column({ type: 'int' })
  durationMs: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
