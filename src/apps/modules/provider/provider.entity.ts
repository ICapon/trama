import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TramaProviderCategory } from '../../../libs/providers';

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  source: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: '1.0.0' })
  version: string;

  @Column({ type: 'enum', enum: TramaProviderCategory })
  category: TramaProviderCategory;

  @Column('text', { array: true, default: '{}' })
  countries: string[];

  @Column('text', { array: true, default: '{}' })
  supportedInputs: string[];

  @Column('text', { array: true, default: '{}' })
  outputNodeTypes: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  totalRuns: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failCount: number;

  @Column({ nullable: true, type: 'int' })
  avgDurationMs: number | null;

  @Column({ nullable: true, type: 'timestamptz' })
  lastRunAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
