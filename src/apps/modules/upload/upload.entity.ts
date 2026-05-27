import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column()
  filename: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column()
  path: string;

  @Column()
  url: string;

  @Column({ nullable: true, type: 'uuid' })
  uploadedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
