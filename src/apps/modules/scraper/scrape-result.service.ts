import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScrapeResult, ScrapeResultStatus } from './scrape-result.entity';

export interface CreateScrapeResultData {
  scrapeJobId: string;
  investigationId: string;
  entityId: string;
  source: string;
  sourceUrl?: string | null;
  status: ScrapeResultStatus;
  confidence?: number | null;
  rawData?: unknown;
  summary?: unknown;
  nodesCreated: number;
  relationshipsCreated: number;
  neo4jNodeIds: string[];
  neo4jScrapeResultId?: string | null;
  executedAt: Date;
  durationMs: number;
}

@Injectable()
export class ScrapeResultService {
  constructor(
    @InjectRepository(ScrapeResult)
    private readonly repo: Repository<ScrapeResult>,
  ) {}

  create(data: CreateScrapeResultData): Promise<ScrapeResult> {
    const result = this.repo.create(data);
    return this.repo.save(result);
  }

  findByInvestigation(investigationId: string): Promise<ScrapeResult[]> {
    return this.repo.find({
      where: { investigationId },
      order: { createdAt: 'DESC' },
    });
  }

  findByEntity(entityId: string): Promise<ScrapeResult[]> {
    return this.repo.find({
      where: { entityId },
      order: { createdAt: 'DESC' },
    });
  }

  findByJob(scrapeJobId: string): Promise<ScrapeResult[]> {
    return this.repo.find({ where: { scrapeJobId } });
  }
}
