import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScrapeStepLog, ScrapeStepType, type StepExtractedData } from './scrape-step-log.entity';

export interface LogStepDto {
  providerSource: string;
  entityId?: string | null;
  stepType: ScrapeStepType;
  url?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  success?: boolean;
  extractedData?: StepExtractedData | null;
  nodesCreated?: number;
  relationshipsCreated?: number;
  nodeTypes?: string[] | null;
  errorMessage?: string | null;
}

@Injectable()
export class ScrapeStepLogService {
  private readonly logger = new Logger(ScrapeStepLogService.name);

  constructor(
    @InjectRepository(ScrapeStepLog)
    private readonly repo: Repository<ScrapeStepLog>,
  ) {}

  async log(dto: LogStepDto): Promise<ScrapeStepLog | null> {
    try {
      const entry = this.repo.create({
        providerSource: dto.providerSource,
        entityId: dto.entityId ?? null,
        stepType: dto.stepType,
        url: dto.url ?? null,
        httpStatus: dto.httpStatus ?? null,
        durationMs: dto.durationMs ?? null,
        success: dto.success ?? true,
        extractedData: dto.extractedData ?? null,
        nodesCreated: dto.nodesCreated ?? 0,
        relationshipsCreated: dto.relationshipsCreated ?? 0,
        nodeTypes: dto.nodeTypes ?? null,
        errorMessage: dto.errorMessage ?? null,
      });
      return await this.repo.save(entry);
    } catch (err) {
      this.logger.error(`Failed to save step log: ${String(err)}`);
      return null;
    }
  }

  findByEntity(entityId: string, providerSource?: string) {
    return this.repo.find({
      where: providerSource ? { entityId, providerSource } : { entityId },
      order: { createdAt: 'ASC' },
    });
  }

  findByProvider(providerSource: string, limit = 100) {
    return this.repo.find({
      where: { providerSource },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  findRecent(limit = 50) {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
