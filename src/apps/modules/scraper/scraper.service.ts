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

  async runForPerson(personId: string, dto: RunScrapeDto) {
    const person = await this.graph.findEntityById(personId);
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    const seed = {
      firstName: person.properties?.['firstName'] as string | undefined,
      lastName: person.properties?.['lastName'] as string | undefined,
      fullName: person.properties?.['fullName'] as string | undefined,
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
      const record = await this.scrapeJobService.create({ personId, source: provider.source, seed });
      const bullJob = await this.queue.add(SCRAPE_PERSON_JOB, {
        scrapeJobId: record.id,
        personId,
        source: provider.source,
        seed,
      });
      await this.scrapeJobService.markRunning(record.id, bullJob.id!, '');
      jobs.push({ id: record.id, source: provider.source, bullJobId: bullJob.id });
    }

    return { jobs };
  }

  getJobStatus(id: string) {
    return this.scrapeJobService.findOne(id);
  }

  getJobsByPerson(personId: string) {
    return this.scrapeJobService.findByPerson(personId);
  }

  listJobs() {
    return this.scrapeJobService.findAll();
  }

  listProviders() {
    return this.providerService.findAll();
  }
}
