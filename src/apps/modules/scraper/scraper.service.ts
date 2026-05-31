import { Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GraphService } from '../graph/graph.service';
import { ScrapeJobService } from './scrape-job.service';
import { ProviderService } from '../provider/provider.service';
import { SCRAPER_QUEUE, SCRAPE_PERSON_JOB } from './queue/scraper.queue';
import { TramaProvider } from '../../../libs/providers';
import { TRAMA_PROVIDERS_TOKEN } from './providers/provider.registry';
import type { RunScrapeDto } from '../../../libs/schemas/scraper.schema';
import type { ScrapeJobPayload } from './scraper.types';

@Injectable()
export class ScraperService implements OnModuleInit {
  constructor(
    @InjectQueue(SCRAPER_QUEUE) private readonly queue: Queue<ScrapeJobPayload>,
    @Inject(TRAMA_PROVIDERS_TOKEN) private readonly providers: TramaProvider[],
    private readonly graph: GraphService,
    private readonly scrapeJobService: ScrapeJobService,
    private readonly providerService: ProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.providerService.syncFromCode(this.providers);
  }

  async runForEntity(entityId: string, entityType: string, dto: RunScrapeDto) {
    const entity = await this.graph.findEntityById(entityId);
    if (!entity) throw new NotFoundException(`Entity ${entityId} not found`);

    const seed = {
      firstName: entity.properties?.['firstName'] as string | undefined,
      lastName: entity.properties?.['lastName'] as string | undefined,
      fullName: entity.properties?.['fullName'] as string | undefined,
      ...dto.seed,
    };

    const activeInDb = await this.providerService.findActiveSources();
    const capable = this.providers.filter((p) => {
      const matchesFilter = !dto.sources?.length || dto.sources.includes(p.source);
      return matchesFilter && activeInDb.has(p.source) && p.canHandle(seed);
    });

    if (!capable.length) {
      return { jobs: [], message: 'No providers capable of handling the given seed data' };
    }

    const jobs: { id: string; source: string; bullJobId: string | undefined }[] = [];
    for (const provider of capable) {
      const providerConfig = dto.config?.[provider.source] as Record<string, unknown> | undefined;
      const record = await this.scrapeJobService.create({
        entityId,
        investigationId: dto.investigationId,
        source: provider.source,
        seed,
        config: providerConfig,
      });
      const bullJob = await this.queue.add(SCRAPE_PERSON_JOB, {
        scrapeJobId: record.id,
        entityId,
        entityType,
        investigationId: dto.investigationId,
        source: provider.source,
        seed,
        config: providerConfig,
      });
      await this.scrapeJobService.markRunning(record.id, bullJob.id!);
      jobs.push({ id: record.id, source: provider.source, bullJobId: bullJob.id });
    }

    return { jobs };
  }

  getJobStatus(id: string) {
    return this.scrapeJobService.findOne(id);
  }

  getJobsByEntity(entityId: string) {
    return this.scrapeJobService.findByEntity(entityId);
  }

  listJobs() {
    return this.scrapeJobService.findAll();
  }

  listProviders() {
    return this.providerService.findAll();
  }
}
