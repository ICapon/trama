import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InvestigationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
}

export enum InvestigationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('investigations')
export class Investigation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({
    type: 'enum',
    enum: InvestigationStatus,
    default: InvestigationStatus.OPEN,
  })
  status: InvestigationStatus;

  @Column({
    type: 'enum',
    enum: InvestigationPriority,
    default: InvestigationPriority.MEDIUM,
  })
  priority: InvestigationPriority;

  // Neo4j node IDs that serve as entry points for this investigation
  @Column('text', { array: true, default: '{}' })
  targetNodeIds: string[];

  // Cached labels for quick display (parallel array to targetNodeIds)
  @Column('text', { array: true, default: '{}' })
  targetNodeLabels: string[];

  // Cached types for quick display (parallel array to targetNodeIds)
  @Column('text', { array: true, default: '{}' })
  targetNodeTypes: string[];

  @Column({ nullable: true, type: 'text' })
  hypothesis: string | null;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  // Will be linked to a User entity once auth is implemented
  @Column({ nullable: true, type: 'uuid' })
  ownerId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
