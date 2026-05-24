import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { GraphService } from '../../graph/graph.service';
import { ScrapeJobService } from '../scrape-job.service';
import { SCRAPER_QUEUE, SCRAPE_PERSON_JOB } from './scraper.queue';
import { BaseScraperProvider } from '../providers/base.provider';
import { SCRAPER_PROVIDERS_TOKEN } from '../providers/provider.registry';
import type { ScrapeJobPayload } from '../scraper.types';

@Processor(SCRAPER_QUEUE)
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    @Inject(SCRAPER_PROVIDERS_TOKEN)
    private readonly providers: BaseScraperProvider[],
    private readonly graph: GraphService,
    private readonly scrapeJobService: ScrapeJobService,
  ) {
    super();
  }

  async process(job: Job<ScrapeJobPayload>): Promise<void> {
    if (job.name !== SCRAPE_PERSON_JOB) return;

    const { scrapeJobId, personId, source, seed } = job.data;
    const provider = this.providers.find((p) => p.source === source);

    if (!provider) {
      this.logger.warn(`No provider registered for source: ${source}`);
      await this.scrapeJobService.markFailed(scrapeJobId, `Unknown provider: ${source}`);
      return;
    }

    this.logger.log(`[${source}] Starting scrape for person ${personId}`);

    const scrapeResultId = randomUUID();
    const now = new Date().toISOString();

    await this.graph.createEntity({
      id: scrapeResultId,
      type: 'ScrapeResult',
      properties: { name: `${source} scrape`, source, scrapeStatus: 'running', createdAt: now },
    });

    await this.graph.createRelationship({
      fromId: personId,
      toId: scrapeResultId,
      type: 'HAS_EVIDENCE',
    });

    await this.scrapeJobService.markRunning(scrapeJobId, job.id!, scrapeResultId);

    try {
      const result = await provider.execute(personId, seed);

      for (const node of result.nodes) {
        await this.graph.createEntity(node);
        await this.graph.createRelationship({
          fromId: node.id,
          toId: scrapeResultId,
          type: 'FOUND_IN_SOURCE',
        });
      }

      for (const rel of result.relationships) {
        await this.graph.createRelationship(rel);
      }

      await this.graph.createEntity({
        id: scrapeResultId,
        type: 'ScrapeResult',
        properties: {
          name: `${source} scrape`,
          source,
          scrapeStatus: 'completed',
          createdAt: now,
          updatedAt: new Date().toISOString(),
        },
      });

      const createdNodeIds = result.nodes.map((n) => n.id);
      await this.scrapeJobService.markCompleted(scrapeJobId, createdNodeIds, result.rawData);

      this.logger.log(
        `[${source}] Done — ${result.nodes.length} nodes, ${result.relationships.length} rels`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.graph.createEntity({
        id: scrapeResultId,
        type: 'ScrapeResult',
        properties: {
          name: `${source} scrape`,
          source,
          scrapeStatus: 'failed',
          createdAt: now,
          updatedAt: new Date().toISOString(),
        },
      });

      await this.scrapeJobService.markFailed(scrapeJobId, errorMessage);
      this.logger.error(`[${source}] Scrape failed for person ${personId}`, error);
      throw error;
    }
  }
}
