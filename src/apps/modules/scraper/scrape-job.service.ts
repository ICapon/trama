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

  create(data: {
    entityId: string;
    investigationId: string;
    source: string;
    seed: TramaProviderSeed;
  }): Promise<ScrapeJob> {
    const job = this.repo.create({ ...data, status: ScrapeJobStatus.PENDING });
    return this.repo.save(job);
  }

  async markRunning(id: string, bullJobId: string): Promise<void> {
    await this.repo.update(id, {
      status: ScrapeJobStatus.RUNNING,
      bullJobId,
      startedAt: new Date(),
    });
  }

  async markCompleted(id: string): Promise<void> {
    await this.repo.update(id, {
      status: ScrapeJobStatus.COMPLETED,
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

  findByEntity(entityId: string): Promise<ScrapeJob[]> {
    return this.repo.find({
      where: { entityId },
      order: { createdAt: 'DESC' },
    });
  }

  findByInvestigation(investigationId: string): Promise<ScrapeJob[]> {
    return this.repo.find({
      where: { investigationId },
      order: { createdAt: 'DESC' },
    });
  }

  findAll(): Promise<ScrapeJob[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
}
