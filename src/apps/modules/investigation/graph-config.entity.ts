import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Investigation } from './investigation.entity';

/** Extensible filter snapshot stored with a config. */
export interface GraphConfigFilters {
  relationshipTypes: string[];
  // future: nodeTypes?: string[];
  // future: confidence?: { min: number };
}

@Entity('graph_configs')
export class GraphConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  investigationId: string;

  @ManyToOne(() => Investigation, { onDelete: 'CASCADE' })
  investigation: Investigation;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  filters: GraphConfigFilters;

  @Column({ type: 'varchar', length: 20 })
  layout: 'force' | 'radial';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
