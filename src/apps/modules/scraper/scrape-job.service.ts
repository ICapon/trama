import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScrapeJob, ScrapeJobStatus } from './scrape-job.entity';
import type { TramaProviderSeed } from '../../../libs/providers';

@Injectable()
export class ScrapeJobService {
  constructor(
    @InjectRepository(ScrapeJob)
    private readonly repo: Repository<ScrapeJob>,
  ) {}

  create(data: { personId: string; source: string; seed: TramaProviderSeed }): Promise<ScrapeJob> {
    const job = this.repo.create({ ...data, status: ScrapeJobStatus.PENDING });
    return this.repo.save(job);
  }

  async markRunning(id: string, bullJobId: string, neo4jScrapeResultId: string): Promise<void> {
    await this.repo.update(id, {
      status: ScrapeJobStatus.RUNNING,
      bullJobId,
      neo4jScrapeResultId,
      startedAt: new Date(),
    });
  }

  async markCompleted(id: string, createdNodeIds: string[], rawResult: unknown): Promise<void> {
    await this.repo.update(id, {
      status: ScrapeJobStatus.COMPLETED,
      createdNodeIds,
      rawResult: rawResult as object,
      finishedAt: new Date(),
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.repo.update(id, {
      status: ScrapeJobStatus.FAILED,
      errorMessage,
      finishedAt: new Date(),
    });
  }

  async findOne(id: string): Promise<ScrapeJob> {
    const job = await this.repo.findOneBy({ id });
    if (!job) throw new NotFoundException(`ScrapeJob ${id} not found`);
    return job;
  }

  findByPerson(personId: string): Promise<ScrapeJob[]> {
    return this.repo.find({
      where: { personId },
      order: { createdAt: 'DESC' },
    });
  }

  findAll(): Promise<ScrapeJob[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
}
