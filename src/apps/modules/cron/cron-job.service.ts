import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { CronJobEntity, CronJobStatus } from './cron-job.entity';
import { SCRAPER_QUEUE, SCRAPE_SCHEDULED_JOB } from '../scraper/queue/scraper.queue';
import type { ScheduledScrapePayload } from '../scraper/scraper.types';
import type { CreateCronJobDto, UpdateCronJobDto } from '../../../libs/schemas/cron-job.schema';

@Injectable()
export class CronJobService implements OnModuleInit {
  private readonly logger = new Logger(CronJobService.name);

  constructor(
    @InjectRepository(CronJobEntity)
    private readonly repo: Repository<CronJobEntity>,
    @InjectQueue(SCRAPER_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const active = await this.repo.find({ where: { status: CronJobStatus.ACTIVE } });
    for (const job of active) {
      await this.schedule(job);
    }
    this.logger.log(`Restored ${active.length} active cron job(s)`);
  }

  async create(dto: CreateCronJobDto): Promise<CronJobEntity> {
    const entity = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      cronExpression: dto.cronExpression,
      source: dto.source,
      entityId: dto.entityId,
      investigationId: dto.investigationId,
      seed: dto.seed ?? null,
      config: dto.config ?? null,
      status: CronJobStatus.ACTIVE,
      schedulerKey: null,
      lastRunAt: null,
    });
    const saved = await this.repo.save(entity);
    await this.schedule(saved);
    return this.repo.findOneByOrFail({ id: saved.id });
  }

  findAll(): Promise<CronJobEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<CronJobEntity> {
    const job = await this.repo.findOneBy({ id });
    if (!job) throw new NotFoundException(`CronJob ${id} not found`);
    return job;
  }

  async update(id: string, dto: UpdateCronJobDto): Promise<CronJobEntity> {
    const job = await this.findOne(id);
    Object.assign(job, {
      ...dto,
      seed: dto.seed ?? job.seed,
      config: dto.config ?? job.config,
    });
    const saved = await this.repo.save(job);
    if (saved.status === CronJobStatus.ACTIVE) {
      await this.schedule(saved);
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const job = await this.findOne(id);
    await this.unschedule(job);
    await this.repo.delete(id);
  }

  async pause(id: string): Promise<CronJobEntity> {
    const job = await this.findOne(id);
    await this.unschedule(job);
    await this.repo.update(id, { status: CronJobStatus.PAUSED });
    return this.findOne(id);
  }

  async resume(id: string): Promise<CronJobEntity> {
    await this.findOne(id);
    await this.repo.update(id, { status: CronJobStatus.ACTIVE });
    const updated = await this.findOne(id);
    await this.schedule(updated);
    return updated;
  }

  private schedulerKey(id: string): string {
    return `cron-job:${id}`;
  }

  private async schedule(job: CronJobEntity): Promise<void> {
    const key = this.schedulerKey(job.id);
    const payload: ScheduledScrapePayload = {
      cronJobId: job.id,
      entityId: job.entityId,
      entityType: 'Person',
      investigationId: job.investigationId,
      source: job.source,
      seed: job.seed ?? {},
      config: job.config ?? undefined,
    };

    await this.queue.upsertJobScheduler(
      key,
      { pattern: job.cronExpression },
      { name: SCRAPE_SCHEDULED_JOB, data: payload },
    );

    await this.repo.update(job.id, { schedulerKey: key });
  }

  private async unschedule(job: CronJobEntity): Promise<void> {
    if (!job.schedulerKey) return;
    await this.queue.removeJobScheduler(job.schedulerKey);
    await this.repo.update(job.id, { schedulerKey: null });
  }
}
