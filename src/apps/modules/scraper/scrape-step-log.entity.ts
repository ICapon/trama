import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ScrapeStepType {
  NAVIGATE     = 'navigate',    // Navegación de página / request HTTP
  API_CAPTURE  = 'api_capture', // Response de API interceptado/capturado
  DOM_SCRAPE   = 'dom_scrape',  // Extracción directa del DOM
  LOGIN        = 'login',       // Flujo de autenticación
  RESULT       = 'result',      // Resumen final del scrape completo
}

// Estructura genérica — no acoplada a ninguna plataforma
export interface StepExtractedData {
  // Campos clave-valor extraídos (aplica a cualquier fuente: perfil, registro, documento)
  fields?: Record<string, string | number | boolean | null>;

  // Tags / entidades encontrados (hashtags, menciones, keywords, categorías, etc.)
  tags?: string[];

  // Colección de ítems encontrados (usuarios, posts, registros, resultados)
  items?: {
    count: number;
    samples?: string[]; // muestra de identificadores: handles, IDs, nombres, URLs
  };

  // Métricas numéricas adicionales (conteos, tamaños, duraciones internas)
  metrics?: Record<string, number>;

  // Contexto de navegación
  navigate?: {
    finalUrl: string;
    capturedEndpoints?: string[];
  };
}

@Entity('scrape_step_logs')
@Index(['providerSource', 'entityId'])
@Index(['providerSource', 'createdAt'])
export class ScrapeStepLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  providerSource: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 50 })
  stepType: ScrapeStepType;

  // URL navegada / endpoint llamado (text para soportar URLs con query params largos)
  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'integer', nullable: true })
  httpStatus: number | null;

  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  @Column({ default: true })
  success: boolean;

  // Datos extraídos en formato genérico
  @Column({ type: 'jsonb', nullable: true })
  extractedData: StepExtractedData | null;

  // Nodos y relaciones creados a partir de este paso
  @Column({ type: 'integer', default: 0 })
  nodesCreated: number;

  @Column({ type: 'integer', default: 0 })
  relationshipsCreated: number;

  @Column({ type: 'simple-array', nullable: true })
  nodeTypes: string[] | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
